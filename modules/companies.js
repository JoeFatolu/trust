const express = require("express")
const auth = require("./auth")
const globals = require("./globals")
// const jsdom = require("jsdom")
const urlMetadata = require("url-metadata")
const Nightmare = require("nightmare")
const fs = require("fs")
const { ObjectId } = require("mongodb")
const nodemailer = require("nodemailer")
const jwt = require("jsonwebtoken")

module.exports =  {

    async hasReviewed(user, domain) {
        return new Promise(async function (callback) {
            const alreadyReviewed = await db.collection("reviews")
                .findOne({
                    $and: [{
                        "user._id": user._id
                    }, {
                        "company.domain": domain
                    }]
                })
            callback(alreadyReviewed != null)
        })
    },

    async addCompany(domain) {

        return new Promise(async function (callback) {
            let domainWithServer = globals.prependHttp(domain)
            let title = ""
            let description = ""
            let keywords = ""
            let author = ""
            let favicons = []
            try {
                const metadata = await urlMetadata(domainWithServer)
                title = metadata["title"] || ""
                description = metadata["description"] || ""
                keywords = metadata["keywords"] || ""
                author = metadata["author"] || ""
                favicons = metadata.favicons || []
            } catch (exp) {
                // 
            }
            
            const faviconsArr = []
            for (let a = 0; a < favicons.length; a++) {
                faviconsArr.push(favicons[a].href)
            }

            const possibleCategories = []
            const categories = globals.categories
            for (let a = 0; a < categories.length; a++) {
                for (let b = 0; b < categories[a].keywords.length; b++) {
                    const lcKeyword = categories[a].keywords[b].toLowerCase()
                    if (title.toLowerCase().includes(lcKeyword)
                        || description.toLowerCase().includes(lcKeyword)
                        || keywords.toLowerCase().includes(lcKeyword)) {
                        possibleCategories.push(categories[a].title)
                        break
                    }
                }
            }

            const screenshot = "uploads/screenshots/" + (new Date().getTime()) + "-" + domain + ".png"
            const companyObj = {
                domain: domain,
                title: title,
                description: description,
                keywords: keywords,
                author: author,
                favicons: faviconsArr,
                screenshot: screenshot,
                categories: possibleCategories,
                ratings: 0,
                reviews: 0,
                isClaimed: false,
                createdAt: new Date().toUTCString(),
                updatedAt: new Date().toUTCString()
            }

            const nightmare = Nightmare({
                show: false,
                width: 1920,
                height: 2000,
                gotoTimeout: 10000000
            })
                
            nightmare
                .goto(domainWithServer)
                .screenshot(screenshot)
                .end()
                .then(async function () {
                    console.log("Captured: " + domainWithServer)

                    await db.collection("companies")
                        .insertOne(companyObj)

                    callback(companyObj)
                })
                .catch(async function (error) {
                    console.log("screenshot failed:", error)

                    companyObj.screenshot = ""
                    await db.collection("companies")
                        .insertOne(companyObj)

                    callback(companyObj)
                })

            // const response = await fetch(domainWithServer);
            // if (response.ok) {
            //     // Convert the HTML string into a document object
            //     const html = response.text()
            //     const dom = new jsdom.JSDOM(html)
            //     const p = dom.window.document.querySelector('p').textContent
            //     console.log(p) 
            // }
        })

    },

    init(app) {
        const self = this
        const router = express.Router()

        router.post("/fetchReview", auth, async function (request, result) {
            const user = request.user
            const _id = request.fields._id || ""

            if (!ObjectId.isValid(_id)) {
                result.json({
                    status: "error",
                    message: "Invalid review ID."
                })
                return
            }

            const review = await db.collection("reviews")
                .findOne({
                    _id: ObjectId(_id)
                })

            if (review == null) {
                result.json({
                    status: "error",
                    message: "Review not found."
                })
                return
            }

            result.json({
                status: "success",
                message: "Data has been fetched.",
                review: review
            })
            return
        })

        router.get("/reply/:_id", function (request, result) {
            result.render("reply-review", {
                _id: request.params._id
            })
        })

        router.post("/update", auth, async function (request, result) {
            const user = request.user
            const domain = request.fields.domain || ""
            const aboutUs = request.fields.aboutUs || ""
            const contactUs = request.fields.contactUs || ""
            const images = request.files.screenshot

            let imagesArr = []
            if (Array.isArray(images)) {
                result.json({
                    status: "error",
                    message: "Please select one image only."
                })
                return
            } else {
                const tempType = images.type.toLowerCase()
                if (tempType.includes("png") || tempType.includes("jpeg") || tempType.includes("jpg")) {
                    if (images.size > 0) {
                        imagesArr.push(images)
                    }
                }
            }

            if (!domain) {
                result.json({
                    status: "error",
                    message: "'domain' field is required."
                })
                return
            }

            const company = await db.collection("companies")
                .findOne({
                    domain: domain
                })

            if (company == null) {
                result.json({
                    status: "error",
                    message: "Company not found."
                })
                return
            }

            const hasClaimed = await db.collection("claims")
                .findOne({
                    $and: [{
                        "company._id": company._id
                    }, {
                        "user._id": user._id
                    }, {
                        isClaimed: true
                    }]
                })

            if (hasClaimed == null) {
                result.json({
                    status: "error",
                    message: "Un-authorized."
                })
                return
            }

            let fileLocation = company.screenshot
            for (let a = 0; a < imagesArr.length; a++) {
                const fileData = await fs.readFileSync(imagesArr[a].path)
                fileLocation = "uploads/screenshots/" + (new Date().getTime()) + "-" + company.domain + "-" + imagesArr[a].name
                await fs.writeFileSync(fileLocation, fileData)
                await fs.unlinkSync(imagesArr[a].path)

                if (await fs.existsSync(company.screenshot)) {
                    await fs.unlinkSync(company.screenshot)
                }
                break
            }

            const updateObj = {
                aboutUs: aboutUs,
                contactUs: contactUs,
                screenshot: fileLocation
            }

            await db.collection("companies")
                .findOneAndUpdate({
                    _id: company._id
                }, {
                    $set: updateObj
                })

            result.json({
                status: "success",
                message: "Data has been updated."
            })
            return
        })

        router.get("/edit/:domain", function (request, result) {
            result.render("edit-company", {
                domain: request.params.domain
            })
        })

        router.post("/toggleFlagReview", auth, async function (request, result) {
            const user = request.user
            const reviewId = request.fields.reviewId

            if (!ObjectId.isValid(reviewId)) {
                result.json({
                    status: "error",
                    message: "Invalid review ID."
                })
                return
            }

            const review = await db.collection("reviews")
                .findOne({
                    _id: ObjectId(reviewId)
                })

            if (review == null) {
                result.json({
                    status: "error",
                    message: "Review not found."
                })
                return
            }

            let flags = []
            if (typeof review.flags !== "undefined") {
                flags = review.flags
            }

            let flag = false
            for (const f of flags) {
                if (f.toString() == user._id.toString()) {
                    flag = true
                    break
                }
            }

            if (flag) {
                result.json({
                    status: "error",
                    message: "You have already flagged for this review."
                })
                return
            }

            await db.collection("reviews")
                .findOneAndUpdate({
                    _id: ObjectId(reviewId)
                }, {
                    $push: {
                        flags: user._id
                    }
                })

            result.json({
                status: "success",
                message: "Feedback has been received."
            })
            return
        })

        router.post("/toggleUsefulReview", auth, async function (request, result) {
            const user = request.user
            const reviewId = request.fields.reviewId

            if (!ObjectId.isValid(reviewId)) {
                result.json({
                    status: "error",
                    message: "Invalid review ID."
                })
                return
            }

            const review = await db.collection("reviews")
                .findOne({
                    _id: ObjectId(reviewId)
                })

            if (review == null) {
                result.json({
                    status: "error",
                    message: "Review not found."
                })
                return
            }

            let usefuls = []
            if (typeof review.usefuls !== "undefined") {
                usefuls = review.usefuls
            }

            let flag = false
            for (const useful of usefuls) {
                if (useful.toString() == user._id.toString()) {
                    flag = true
                    break
                }
            }

            if (flag) {
                await db.collection("reviews")
                    .findOneAndUpdate({
                        _id: ObjectId(reviewId)
                    }, {
                        $pull: {
                            usefuls: user._id
                        }
                    })
            } else {
                await db.collection("reviews")
                    .findOneAndUpdate({
                        _id: ObjectId(reviewId)
                    }, {
                        $push: {
                            usefuls: user._id
                        }
                    })
            }

            result.json({
                status: "success",
                message: "Feedback has been received.",
                feedback: !flag
            })
            return
        })

        router.get("/render-widget/:_id", function (request, result) {
            const _id = request.params._id || ""
            if (ObjectId.isValid(_id)) {
                db.collection("companies")
                    .findOne({
                        _id: ObjectId(_id)
                    }, function (error, company) {
                        // Set Content-Type header to text/javascript
                        result.setHeader('Content-Type', 'text/javascript')

                        if (company != null) {
                            company.screenshot = mainURL + "/" + company.screenshot
                            company.starColor = globals.getStarColor(company.ratings)

                            let html = ""
                            html += `<link rel="stylesheet" href="` + mainURL + `/public/css/font-awesome.css" />`
                            html += `<link rel="stylesheet" href="` + mainURL + `/public/css/style.css" />`
                            html += `<div style="display: flex; align-items: center; justify-content: center;">`
                                html += `<a href="#" style="display: contents; color: black;">`
                                    html += `<span>Our customers say <b style="margin-left: 10px; margin-right: 10px;">` + (globals.relativeReview(company.ratings)) + `</b></span>`
                                    html += `<div class="stars">`
                                        for (let a = 1; a <= 5; a++) {
                                            let color = globals.getStarColorRGB(company.ratings)
                                            html += `<i class="fa fa-star star ` + (a > company.ratings ? 'initial' : company.starColor) + `" style="font-size: 20px;"></i>`
                                        }
                                html += `</div>`
                                    if (company.ratings > 0) {
                                        html += `<span style="font-size: 16px; margin-left: 10px; color: gray;">` + company.ratings + ` Out of 5 based on ` + company.reviews + ` reviews</span>`
                                    }
                            html += `<img src="` + mainURL + `/public/img/logo.png" style="width: 150px; margin-left: 10px;" />`
                            html += `</a>`
                            html += `</div>`
                            const htmlContent = `
                                document.getElementById('trustpilot-root').innerHTML = '` + html + `'
                            `
                            // Send the JavaScript code as the response
                            result.send(htmlContent)
                            return
                        }

                        result.send("")
                        return
                    })
            }
        })

        router.post("/my-claimed", auth, async function (request, result) {
            const user = request.user

            // number of records you want to show per page
            const perPage = 10
         
            // get current page number
            const pageNumber = (request.query.page == null) ? 1 : request.query.page
         
            // get records to skip
            const startFrom = (pageNumber - 1) * perPage

            const claims = await db.collection("claims")
                .find({
                    $and: [{
                        "user._id": user._id
                    }, {
                        isClaimed: true
                    }]                    
                })
                .toArray()

            const companyIds = []
            for (const c of claims) {
                companyIds.push(c.company._id)
            }
         
            // get data from mongo DB using pagination
            var companies = await db.collection("companies").find({
                _id: {
                    $in: companyIds
                }
            })
                .sort({ _id: -1 })
                .skip(startFrom)
                .limit(perPage)
                .toArray()

            for (const c of companies) {
                if (c.screenshot != "") {
                    c.screenshot = mainURL + "/" + c.screenshot
                }
                c.starColor = globals.getStarColor(c.ratings)
            }

            result.json({
                status: "success",
                message: "Data has been fetched.",
                companies: companies
            })
        })

        router.post("/fetchByCategory", async function (request, result) {
            const category = request.fields.category || ""
            /*if (!category) {
                result.json({
                    status: "error",
                    message: "Category field is required."
                })
                return
            }*/
            let filter = {}
            if (category) {
                filter = {
                    categories: category
                }
            }

            // number of records you want to show per page
            const perPage = 10
         
            // total number of records from database
            // const total = await db.collection("companies").count()
         
            // Calculating number of pagination links required
            // const pages = Math.ceil(total / perPage)
         
            // get current page number
            const pageNumber = (request.query.page == null) ? 1 : request.query.page
         
            // get records to skip
            const startFrom = (pageNumber - 1) * perPage

            let companies = await db.collection("companies")
                .find(filter)
                .sort({
                    ratings: -1
                })
                .skip(startFrom)
                .limit(perPage)
                .toArray()

            for (let a = 0; a < companies.length; a++) {
                companies[a].screenshot = mainURL + "/" + companies[a].screenshot
                companies[a].starColor = globals.getStarColor(companies[a].ratings)
            }

            result.json({
                status: "success",
                message: "Data has been fetched.",
                companies: companies
            })
            return
        })

        router.get("/fetch-image/:_id", async function (request, result) {
            const _id = request.params._id

            var fileData = await fs.readFileSync("public/img/placeholder-image.png")
            var buffer = Buffer.from(fileData, "base64")

            if (!_id) {
                result.writeHead(200, {
                    "Content-Type": "image/png",
                    "Content-Length": buffer.length
                })

                result.end(buffer)
                return
            }

            const filter = []
            if (ObjectId.isValid(_id)) {
                filter.push({
                    _id: ObjectId(_id)
                })
            }

            const company = await db.collection("companies")
                .findOne({
                    $or: filter
                })

            if (company != null && company.screenshot) {

                /*const files = await bucket
                    .find({
                        filename: user.profileImage
                    })
                    .toArray()
             
                if (!files || files.length === 0) {
                    result.writeHead(200, {
                        "Content-Type": "image/png",
                        "Content-Length": buffer.length
                    })

                    result.end(buffer)
                    return
                }
             
                bucket.openDownloadStreamByName(user.profileImage).pipe(result)
                return*/

                if (await fs.existsSync(company.screenshot)) {
                    const fileData = await fs.readFileSync(company.screenshot)
                    const buffer = Buffer.from(fileData, "base64")
                    result.writeHead(200, {
                        "Content-Type": "image/png",
                        "Content-Length": buffer.length
                    })

                    result.end(buffer)
                    return
                }

                /*let base64 = user.profileImage.buffer

                result.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': base64.length
                })
                result.end(base64)
                return*/
            }

            result.writeHead(200, {
                "Content-Type": "image/png",
                "Content-Length": buffer.length
            })

            result.end(buffer)
            return
        })

        router.post("/verify-claim", auth, async function (request, result) {
            const user = request.user
            const domain = request.fields.domain
            const code = request.fields.code

            if (!domain || !code) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })
                return
            }

            const company = await db.collection("companies")
                .findOne({
                    domain: domain
                })

            if (company == null) {
                result.json({
                    status: "error",
                    message: "Company not found."
                })
                return
            }

            if (company.isClaimed) {
                result.json({
                    status: "error",
                    message: "This company is already been claimed."
                })
                return
            }

            const claim = await db.collection("claims")
                .findOne({
                   $and: [{
                        "company.domain": domain
                    }, {
                        "user._id": user._id
                    }]
                })

            if (claim == null) {
                result.json({
                    status: "error",
                    message: "This company is not up for claim."
                })
                return
            }

            if (claim.code != code) {
                result.json({
                    status: "error",
                    message: "Wrong verification code."
                })
                return
            }

            if (claim.user._id.toString() != user._id.toString()) {
                result.json({
                    status: "error",
                    message: "Un-authorized."
                })
                return
            }

            await db.collection("claims")
                .findOneAndUpdate({
                    _id: claim._id
                }, {
                    $set: {
                        isClaimed: true,
                        updatedAt: new Date().toUTCString()
                    }
                })

            await db.collection("companies")
                .findOneAndUpdate({
                    _id: company._id
                }, {
                    $set: {
                        isClaimed: true,
                        updatedAt: new Date().toUTCString()
                    }
                })

            result.json({
                status: "success",
                message: "Congratulations ! Company has been claimed."
            })
            return
        })

        router.post("/claim", auth, async function (request, result) {
            const user = request.user
            const domain = request.fields.domain
            const email = request.fields.email

            if (!domain || !email) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })
                return
            }

            const claim = await db.collection("claims")
                .findOne({
                    $and: [{
                        "company.domain": domain
                    }, {
                        "user._id": user._id
                    }]
                })

            if (claim != null) {
                result.json({
                    status: "error",
                    message: "You have already claimed for this website."
                })
                return
            }

            const company = await db.collection("companies")
                .findOne({
                    domain: domain
                })

            let companyObj = company
            if (company == null) {
                companyObj = await self.addCompany(domain)
            }

            if (companyObj.isClaimed) {
                result.json({
                    status: "error",
                    message: "This company is already been claimed."
                })
                return
            }

            const hasSubscription = await db.collection("subscriptions")
                .findOne({
                    $and: [{
                        "user._id": user._id
                    }, {
                        isActive: true
                    }]
                })

            if (hasSubscription == null) {
                result.json({
                    status: "error",
                    message: "You do not have any active subscription."
                })
                return
            }

            const minimum = 0
            const maximum = 999999
            const code = Math.floor(Math.random() * (maximum - minimum + 1)) + minimum
            const fullEmail = email + "@" + domain

            const emailHtml = "Your verification code to claim the website '" + domain + "' is: <b style='font-size: 30px;'>" + code + "</b>."
            const emailPlain = "Your verification code to claim the website '" + domain + "' is: " + code + "."

            let emailId = ""
            const settings = await db.collection("settings")
                .findOne({})

            if (settings != null && settings.smtp) {
                const transport = nodemailer.createTransport({
                    host: settings.smtp.host,
                    port: settings.smtp.port,
                    secure: true,
                    auth: {
                        user: settings.smtp.email,
                        pass: settings.smtp.password
                    }
                })

                const emailResponse = await transport.sendMail({
                    from: settings.smtp.email,
                    to: fullEmail,
                    subject: "Claim Website",
                    text: emailPlain,
                    html: emailHtml
                })
                emailId = emailResponse.messageId
            }

            const claimObj = {
                company: {
                    _id: companyObj._id,
                    domain: companyObj.domain
                },
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email
                },
                email: fullEmail,
                code: code,
                emailId: emailId,
                isClaimed: false,
                createdAt: new Date().toUTCString(),
                updatedAt: new Date().toUTCString()
            }
            await db.collection("claims")
                .insertOne(claimObj)

            result.json({
                status: "success",
                message: "Verification code has been emailed at '" + fullEmail + "'."
            })
            return
        })

        router.post("/reviews", async function (request, result) {
            const domain = request.fields.domain || ""
            const perPage = 10
            const page = request.fields.page || 1

            if (page <= 0) {
                result.json({
                    status: "error",
                    message: "'page' must be an un-signed integer."
                })
                return
            }

            const reviews = await db.collection("reviews")
                .find({
                    "company.domain": domain
                })
                .limit(perPage)
                .skip((page - 1) * perPage)
                .sort({
                    createdAt: -1
                })
                .toArray()

            result.json({
                status: "success",
                message: "Data has been fetched.",
                reviews: reviews
            })
            return
        })

        router.post("/fetch", async function (request, result) {
            const domain = request.fields.domain

            if (!domain) {
                result.json({
                    status: "error",
                    message: "'domain' field is required."
                })
                return
            }

            const company = await db.collection("companies")
                .findOne({
                    domain: domain
                })

            if (company == null) {
                result.json({
                    status: "error",
                    message: "Company not found."
                })
                return
            }

            result.json({
                status: "success",
                message: "Data has been fetched.",
                company: company
            })
            return
        })

        router.post("/reply-on-review", auth, async function (request, result) {
            const user = request.user
            const _id = request.fields._id
            const reply = request.fields.reply

            if (!_id || !reply) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })
                return
            }

            if (!ObjectId.isValid(_id)) {
                result.json({
                    status: "error",
                    message: "In-valid ID."
                })
                return
            }

            const review = await db.collection("reviews")
                .findOne({
                    _id: ObjectId(_id)
                })

            if (review == null) {
                result.json({
                    status: "error",
                    message: "Review not found."
                })
                return
            }

            const claim = await db.collection("claims")
                .findOne({
                    $and: [{
                        "company.domain": review.company.domain
                    }, {
                        "user._id": user._id
                    }, {
                        isClaimed: true
                    }]
                })

            if (claim == null) {
                result.json({
                    status: "error",
                    message: "Un-authorized."
                })
                return
            }

            const hasSubscription = await db.collection("subscriptions")
                .findOne({
                    $and: [{
                        "user._id": user._id
                    }, {
                        isActive: true
                    }]
                })

            if (hasSubscription == null) {
                result.json({
                    status: "error",
                    message: "You do not have any active subscription."
                })
                return
            }

            const replyObj = {
                _id: ObjectId(),
                reply: reply,
                user: {
                    _id: user._id,
                    name: user.name
                },
                createdAt: new Date().toUTCString()
            }

            await db.collection("reviews")
                .findOneAndUpdate({
                    _id: review._id
                }, {
                    $push: {
                        replies: replyObj
                    },

                    $set: {
                        updatedAt: new Date().toUTCString()
                    }
                })

            result.json({
                status: "success",
                message: "Reply has been posted.",
                reply: replyObj
            })
            return
        })

        router.post("/deleteReview", auth, async function (request, result) {
            const user = request.user
            const _id = request.fields._id ?? ""
            if (!_id) {
                result.json({
                    status: "error",
                    message: "ID field is required."
                })
                return
            }

            if (!ObjectId.isValid(_id)) {
                result.json({
                    status: "error",
                    message: "Invalid ID."
                })
                return
            }

            const review = await db.collection("reviews")
                .findOne({
                    $and: [{
                        _id: ObjectId(_id)
                    }, {
                        "user._id": user._id
                    }]
                })

            if (review == null) {
                result.json({
                    status: "error",
                    message: "Review not found."
                })
                return
            }

            await db.collection("reviews")
                .deleteOne({
                    _id: review._id
                })

            db.collection("reviews")
                .aggregate([
                    {
                        $match: {
                            "company._id": review.company._id
                        }
                    },
                    {
                        $group: {
                            _id: "$_id",
                            ratings: {
                                $sum: "$ratings"
                            }
                        }
                    }
                ]).toArray(function (error, reviewsArr) {
                    let totalRatings = 0
                    for (let a = 0; a < reviewsArr.length; a++) {
                        totalRatings += reviewsArr[a].ratings
                    }

                    db.collection("reviews")
                        .countDocuments({
                            "company._id": review.company._id
                        }, function (error, totalReviews) {
                            db.collection("companies")
                                .findOneAndUpdate({
                                    _id: review.company._id
                                }, {
                                    $set: {
                                        ratings: Math.abs((totalRatings / totalReviews).toFixed(2)),
                                        updatedAt: new Date().toUTCString()
                                    },

                                    $inc: {
                                        reviews: -1
                                    }
                                })
                        })
                })

            db.collection("users")
                .findOneAndUpdate({
                    _id: user._id
                }, {
                    $inc: {
                        reviews: -1
                    }
                })

            db.collection("reviews")
                .updateMany({
                    $and: [{
                        "user._id": user._id
                    }, {
                        _id: {
                            $ne: review._id
                        }
                    }]
                }, {
                    $inc: {
                        "user.reviews": -1
                    }
                })

            result.json({
                status: "success",
                message: "Review has been deleted."
            })
        })

        router.post("/review", auth, async function (request, result) {
            const user = request.user
            const domain = request.fields.domain
            const ratings = request.fields.ratings
            const title = request.fields.title
            const review = request.fields.review
            const files = request.files.files
            const images = request.files.images
            const videos = request.files.videos
            const dateOfExperience = request.fields.dateOfExperience

            if (!domain || !ratings || !title || !review || !images || !dateOfExperience) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })
                return
            }

            if (ratings < 1 || ratings > 5) {
                result.json({
                    status: "error",
                    message: "Ratings must be in-between 1 and 5."
                })
                return
            }

            const alreadyReviewed = await self.hasReviewed(user, domain)
            if (alreadyReviewed) {
                result.json({
                    status: "error",
                    message: "You have already gave your reviews about this company."
                })
                return
            }

            let imagesArr = []
            if (Array.isArray(images)) {
                for (let a = 0; a < images.length; a++) {
                    const tempType = images[a].type.toLowerCase()
                    if (tempType.includes("png") || tempType.includes("jpeg") || tempType.includes("jpg")) {
                        if (images[a].size > 0) {
                            imagesArr.push(images[a])
                        }
                    }
                }
            } else {
                const tempType = images.type.toLowerCase()
                if (tempType.includes("png") || tempType.includes("jpeg") || tempType.includes("jpg")) {
                    if (images.size > 0) {
                        imagesArr.push(images)
                    }
                }
            }
            if (imagesArr.length == 0) {
                result.json({
                    status: "error",
                    message: "Please select file (JPEG or PNG) as an image."
                })
                return
            }

            if (imagesArr.length < 3) {
                result.json({
                    status: "error",
                    message: "Please select at least 3 images."
                })
                return
            }

            let videosArr = []
            if (videos) {
                if (Array.isArray(videos)) {
                    for (let a = 0; a < videos.length; a++) {
                        const tempType = videos[a].type.toLowerCase()
                        if (tempType.includes("mp4") || tempType.includes("mov") || tempType.includes("flv") || tempType.includes("mkv")) {
                            if (videos[a].size > 0) {
                                videosArr.push(videos[a])
                            }
                        }
                    }
                } else {
                    const tempType = videos.type.toLowerCase()
                    if (tempType.includes("mp4") || tempType.includes("mov") || tempType.includes("flv") || tempType.includes("mkv")) {
                        if (videos.size > 0) {
                            videosArr.push(videos)
                        }
                    }
                }
            }
            /*if (videosArr.length == 0) {
                result.json({
                    status: "error",
                    message: "Please select file (MP4, MOV, FLV or MKV) as a video."
                })
                return
            }*/

            try {
                /*const filesArr = []

                if (ratings < 3) {
                    if (Array.isArray(files)) {
                        for (let a = 0; a < files.length; a++) {
                            const tempType = files[a].type.toLowerCase()
                            if (tempType.includes("png") || tempType.includes("jpeg") || tempType.includes("jpg") || tempType.includes("pdf") || files[a].size > 0) {
                                filesArr.push(files[a])
                            }
                        }
                    } else {
                        const tempType = files.type.toLowerCase()
                        if (tempType.includes("png") || tempType.includes("jpeg") || tempType.includes("jpg") || tempType.includes("pdf") || files[a].size > 0) {
                            filesArr.push(files)
                        }
                    }

                    if (filesArr.length == 0) {
                        result.json({
                            status: "error",
                            message: "Please select file (JPEG, PNG or PDF) as a proof."
                        })
                        return
                    }
                }*/

                const company = await db.collection("companies")
                    .findOne({
                        domain: domain
                    })

                let companyObj = company
                if (company == null) {
                    companyObj = await self.addCompany(domain)
                }

                /*const proofs = []
                for (let a = 0; a < filesArr.length; a++) {
                    const fileData = await fs.readFileSync(filesArr[a].path)
                    const fileLocation = "uploads/reviews/" + (new Date().getTime()) + "-" + filesArr[a].name
                    await fs.writeFileSync(fileLocation, fileData)
                    await fs.unlinkSync(filesArr[a].path)
                    proofs.push(fileLocation)
                }*/

                const proofImages = []
                for (let a = 0; a < imagesArr.length; a++) {
                    const fileData = await fs.readFileSync(imagesArr[a].path)
                    const fileLocation = "uploads/reviews/" + (new Date().getTime()) + "-" + imagesArr[a].name
                    await fs.writeFileSync(fileLocation, fileData)
                    await fs.unlinkSync(imagesArr[a].path)
                    proofImages.push(fileLocation)
                }

                const proofVideos = []
                for (let a = 0; a < videosArr.length; a++) {
                    const fileData = await fs.readFileSync(videosArr[a].path)
                    const fileLocation = "uploads/reviews/" + (new Date().getTime()) + "-" + videosArr[a].name
                    await fs.writeFileSync(fileLocation, fileData)
                    await fs.unlinkSync(videosArr[a].path)
                    proofVideos.push(fileLocation)
                }

                const reviewObj = {
                    company: {
                        _id: companyObj._id,
                        domain: domain,
                        title: companyObj.title
                    },
                    user: {
                        _id: user._id,
                        name: user.name,
                        reviews: ++user.reviews,
                        location: user.location?.countryCode ?? ""
                    },
                    ratings: Math.abs(ratings),
                    title: title,
                    review: review,
                    // proofs: proofs,
                    images: proofImages,
                    videos: proofVideos,
                    replies: [],
                    usefuls: [], // this will be the array of user Object IDs
                    shares: 0,
                    flags: [],  // this will be the array of user Object IDs
                    dateOfExperience: dateOfExperience,
                    createdAt: new Date().toUTCString(),
                    updatedAt: new Date().toUTCString()
                }
                await db.collection("reviews")
                    .insertOne(reviewObj)

                db.collection("reviews")
                    .aggregate([
                        {
                            $match: {
                                "company._id": companyObj._id
                            }
                        },
                        {
                            $group: {
                                _id: "$_id",
                                ratings: {
                                    $sum: "$ratings"
                                }
                            }
                        }
                    ]).toArray(function (error, reviewsArr) {
                        let totalRatings = 0
                        for (let a = 0; a < reviewsArr.length; a++) {
                            totalRatings += reviewsArr[a].ratings
                        }

                        db.collection("reviews")
                            .countDocuments({
                                "company._id": companyObj._id
                            }, function (error, totalReviews) {
                                db.collection("companies")
                                    .findOneAndUpdate({
                                        _id: companyObj._id
                                    }, {
                                        $set: {
                                            ratings: Math.abs((totalRatings / totalReviews).toFixed(2)),
                                            updatedAt: new Date().toUTCString()
                                        },

                                        $inc: {
                                            reviews: 1
                                        }
                                    })
                            })
                    })

                db.collection("users")
                    .findOneAndUpdate({
                        _id: user._id
                    }, {
                        $inc: {
                            reviews: 1
                        }
                    })

                db.collection("reviews")
                    .updateMany({
                        $and: [{
                            "user._id": user._id
                        }, {
                            _id: {
                                $ne: reviewObj["_id"]
                            }
                        }]
                    }, {
                        $set: {
                            "user.location": user.location?.countryCode ?? ""
                        },

                        $inc: {
                            "user.reviews": 1
                        }
                    })

                db.collection("claims")
                    .findOne({
                        $and: [{
                            "company._id": companyObj._id
                        }, {
                            isClaimed: true
                        }]
                    }, function (error, claim) {
                        if (claim != null) {
                            const emailHtml = "A new review has been posted on your company: <a href='" + mainURL + "/company/" + companyObj.domain + "'>" + companyObj.domain + "</a></b>"
                            const emailPlain = "A new review has been posted on your company: " + companyObj.domain

                            transport.sendMail({
                                from: nodemailerFrom,
                                to: claim.user.email,
                                subject: "New Review at: " + companyObj.domain,
                                text: emailPlain,
                                html: emailHtml
                            }, function (error, info) {
                                console.log("Email sent: ", info)
                            })
                        }
                    })

                result.json({
                    status: "success",
                    message: "Review has been posted.",
                    review: reviewObj
                })
                return
            } catch (exp) {
                result.json({
                    status: "error",
                    message: exp.message
                })
                return
            }
        })

        router.post("/search", async function (request, result) {
            const query = request.fields.query

            if (!query) {
                result.json({
                    status: "error",
                    message: "'query' field is required."
                })
                return
            }

            try {
                const companies = await db.collection("companies")
                    .find({
                        $or: [{
                            domain: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }, {
                            title: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }, {
                            description: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }, {
                            keywords: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }, {
                            author: {
                                $regex: ".*" + query + ".*",
                                $options: "i"
                            }
                        }]
                    })
                    .sort({
                        updatedAt: -1
                    })
                    .toArray()

                for (let a = 0; a < companies.length; a++) {
                    companies[a].screenshot = mainURL + "/" + companies[a].screenshot
                    companies[a].starColor = globals.getStarColor(companies[a].ratings)
                    // companies[a].domainWithServer = globals.prependHttp(companies[a].domain)
                }

                result.json({
                    status: "success",
                    message: "Data has been fetched.",
                    companies: companies
                })
                return
            } catch (exp) {
                result.json({
                    status: "error",
                    message: exp.message
                })
                return
            }
        })

        router.post("/find", async function (request, result) {
            const domain = request.fields.domain
            let user = null
            try {
                const accessToken = request.headers.authorization.split(" ")[1]
                const decoded = jwt.verify(accessToken, jwtSecret)
                const userId = decoded.userId
         
                user = await db.collection("users").findOne({
                    accessToken: accessToken
                })
            } catch (exp) {
                // console.log(exp)
            }

            if (!domain) {
                result.json({
                    status: "error",
                    message: "'domain' field is required."
                })
                return
            }

            try {
                const company = await db.collection("companies")
                    .findOne({
                        domain: domain
                    })

                let companyObj = company
                if (company == null) {
                    companyObj = await self.addCompany(domain)
                }

                companyObj.screenshot = mainURL + "/" + companyObj.screenshot
                companyObj.domainWithServer = globals.prependHttp(companyObj.domain)
                companyObj.starColor = globals.getStarColor(companyObj.ratings)

                const perPage = 10
                const page = request.fields.page || 1

                if (page <= 0) {
                    result.json({
                        status: "error",
                        message: "'page' must be an un-signed integer."
                    })
                    return
                }

                let hasReviewed = false
                let isMyClaimed = false
                if (user != null) {
                    hasReviewed = await self.hasReviewed(user, companyObj.domain)
                    const hasClaimed = await db.collection("claims")
                        .findOne({
                            $and: [{
                                "company._id": companyObj._id
                            }, {
                                "user._id": user._id
                            }, {
                                isClaimed: true
                            }]
                        })
                    isMyClaimed = (hasClaimed != null)
                }

                const reviews = await db.collection("reviews")
                    .find({
                        "company._id": companyObj._id
                    })
                    .limit(perPage)
                    .skip((page - 1) * perPage)
                    .sort({
                        createdAt: 1
                    })
                    .toArray()

                for (const r of reviews) {
                    if (isMyClaimed) {
                        for (let a = 0; a < r.images?.length; a++) {
                            r.images[a] = mainURL + "/" + r.images[a]
                        }

                        for (let a = 0; a < r.videos?.length; a++) {
                            r.videos[a] = mainURL + "/" + r.videos[a]
                        }
                    } else {
                        delete r.images
                        delete r.videos
                    }
                    if (typeof r.usefuls === "undefined") {
                        r.usefuls = []
                    }
                    if (typeof r.shares === "undefined") {
                        r.shares = 0
                    }
                    if (typeof r.flags === "undefined") {
                        r.flags = []
                    }
                }

                result.json({
                    status: "success",
                    message: "Data has been fetched.",
                    company: companyObj,
                    reviews: reviews,
                    hasReviewed: hasReviewed,
                    isMyClaimed: isMyClaimed
                })
                return
            } catch (exp) {
                result.json({
                    status: "error",
                    message: exp.message
                })
                return
            }
        })

        app.use("/companies", router)
    }
}