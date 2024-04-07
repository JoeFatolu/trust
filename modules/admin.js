const express = require("express")
const { ObjectId } = require("mongodb")
const bcryptjs = require("bcryptjs")
// JWT used for authentication
const jwt = require("jsonwebtoken")
const fs = require("fs")
const { parse } = require("csv-parse")
const globals = require("./globals")
const companies = require("./companies")
const authAdmin = require("./authAdmin")

module.exports = {

    logoutMessage: "Admin has been logged out. Please login again.",

    init: function (app) {
        var self = this
        const router = express.Router()

        router.post("/importCompanies", authAdmin, async function (request, result) {
            const admin = request.admin
            const file = request.files.file

            if (!file) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })
                return
            }

            let filesArr = []
            if (Array.isArray(file)) {
                for (let a = 0; a < file.length; a++) {
                    const tempType = file[a].type.toLowerCase()
                    if (tempType.includes("csv")) {
                        if (file[a].size > 0) {
                            filesArr.push(file[a])
                        }
                    }
                }
            } else {
                const tempType = file.type.toLowerCase()
                if (tempType.includes("csv")) {
                    if (file.size > 0) {
                        filesArr.push(file)
                    }
                }
            }

            if (filesArr.length == 0) {
                result.json({
                    status: "error",
                    message: "Please select CSV file only."
                })
                return
            }

            const importedCompanies = []
            for (let a = 0; a < filesArr.length; a++) {
                const fileData = await fs.readFileSync(filesArr[a].path)
                const fileLocation = "imported/" + (new Date().getTime()) + "-" + filesArr[a].name
                await fs.writeFileSync(fileLocation, fileData)
                await fs.unlinkSync(filesArr[a].path)

                fs.createReadStream(fileLocation)
                    .pipe(parse({ delimiter: ",", from_line: 1 }))
                    .on("data", async function (row) {
                        for (let a = 0; a < row.length; a++) {
                            await companies.addCompany(row[a])
                            importedCompanies.push(row[a])
                        }
                    })
            }

            const interval = setInterval(function () {
                if (importedCompanies.length == filesArr.length) {
                    clearInterval(interval)

                    result.json({
                        status: "success",
                        message: "Companies has been imported."
                    })
                    return
                }
            }, 1000)
        })

        router.post("/fetchCompanies", authAdmin, async function (request, result) {
            const search = request.fields.search || ""

            let filter = {}
            if (search != "") {
                filter = {
                    $or: [{
                        domain: search                        
                    }]
                }
            }

            // number of records you want to show per page
            const perPage = 50

            // total number of records from database
            const total = await db.collection("companies").countDocuments(filter)

            // Calculating number of pagination links required
            const pages = Math.ceil(total / perPage)

            // get current page number
            const pageNumber = (request.query.page == null) ? 1 : request.query.page

            // get records to skip
            const startFrom = (pageNumber - 1) * perPage

            const companies = await db.collection("companies")
                .find(filter)
                .sort({
                    _id: -1
                })
                .skip(startFrom)
                .limit(perPage)
                .toArray()

            for (let a = 0; a < companies.length; a++) {
                if (companies[a].screenshot && await fs.existsSync(companies[a].screenshot)) {
                    companies[a].screenshot = mainURL + "/" + companies[a].screenshot
                }
            }

            result.json({
                status: "success",
                message: "Data has been fetched.",
                data: companies
            })
            return
        })

        router.get("/companies", function (request, result) {
            result.render("admin/companies")
        })

        router.post("/fetchFlaggedReviews", authAdmin, async function (request, result) {
            const admin = request.admin

            const reviews = await db.collection("reviews")
                .find({
                    $expr: {
                        $gt: [{
                            $size: "$flags"
                        }, 0]
                    }
                })
                .toArray()

            for (const review of reviews) {
                let flags = []
                if (typeof review.flags !== "undefined") {
                    flags = review.flags
                }

                const flaggedBy = []
                for (const flag of flags) {
                    const user = await db.collection("users")
                        .findOne({
                            _id: flag
                        })

                    if (user != null) {
                        flaggedBy.push({
                            _id: user._id,
                            name: user.name,
                            email: user.email
                        })
                    }
                }
                review.flaggedBy = flaggedBy
            }

            result.json({
                status: "success",
                message: "Data has been fetched.",
                data: reviews
            })
            return
        })

        router.get("/flags", async function (request, result) {
            result.render("admin/flags")
        })

        router.post("/settings/save", async function (request, result) {
            const accessToken = request.fields.accessToken ?? ""
            const smtp_host = request.fields.smtp_host ?? ""
            const smtp_port = request.fields.smtp_port ?? ""
            const smtp_email = request.fields.smtp_email ?? ""
            const smtp_password = request.fields.smtp_password ?? ""
            const stripe_publishable_key = request.fields.stripe_publishable_key ?? ""
            const stripe_secret_key = request.fields.stripe_secret_key ?? ""
            let subscriptionData = request.fields.subscriptionData ?? "[]"
            subscriptionData = JSON.parse(subscriptionData)

            for (let a = 0; a < subscriptionData.length; a++) {
                subscriptionData[a].days = parseInt(subscriptionData[a].days)
                subscriptionData[a].amount = parseFloat(subscriptionData[a].amount)
            }

            const admin = await db.collection("admins").findOne({
                accessToken: accessToken
            })
            
            if (admin == null) {
                result.json({
                    status: "error",
                    message: "Admin has been logged out. Please login again."
                })
                return
            }

            await db.collection("settings")
                .findOneAndUpdate({}, {
                    $set: {
                        smtp: {
                            host: smtp_host,
                            port: smtp_port,
                            email: smtp_email,
                            password: smtp_password
                        },
                        stripe: {
                            publishable_key: stripe_publishable_key,
                            secret_key: stripe_secret_key
                        },
                        subscriptions: subscriptionData
                    }
                }, {
                    upsert: true
                })

            result.json({
                status: "success",
                message: "Settings has been saved."
            })
            return
        })

        router.get("/settings", async function (request, result) {
            const settings = await db.collection("settings").findOne({})
            result.render("admin/settings", {
                settings: settings
            })
        })

        router.post("/fetchAds", async function (request, result) {
            const accessToken = request.fields.accessToken

            const admin = await db.collection("admins").findOne({
                accessToken: accessToken
            })
            
            if (admin == null) {
                result.json({
                    status: "error",
                    message: "Admin has been logged out. Please login again."
                })
                return
            }

            const ads = await db.collection("advertisements").find({})
                .sort({ createdAt: -1 })
                .toArray()

            result.json({
                status: "success",
                message: "Data has been fetched.",
                ads: ads
            })
        })

        router.get("/ads", async function (request, result) {
            result.render("admin/ads")
        })

        router.post("/users/update", authAdmin, async function (request, result) {
            const _id = request.fields._id
            const name = request.fields.name
            let days = request.fields.days || 0
            days = parseInt(days)
            const type = request.fields.type || ""

            if (!_id || !name) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })

                return
            }

            if (type != "" && !["trial", "subscription"].includes(type)) {
                result.json({
                    status: "error",
                    message: "Invalid subscription type."
                })

                return
            }

            if (!ObjectId.isValid(_id)) {
                result.json({
                    status: "error",
                    message: "Invalid User ID."
                })
                return
            }

            const user = await db.collection("users").findOne({
                _id: ObjectId(_id)
            })

            if (user == null) {
                result.json({
                    status: "error",
                    message: "User does not exists."
                })

                return
            }

            if (days < 0) {
                result.json({
                    status: "error",
                    message: "Days must be greater than 0."
                })
                return
            }

            await db.collection("users").findOneAndUpdate({
                _id: user._id
            }, {
                $set: {
                    name: name
                }
            })

            const expireOn = new Date(new Date().getTime() + (days * 24 * 60 * 60 * 1000))

            const updateObj = {
                type: type,
                expireOn: expireOn.getTime()
            }

            updateObj.isActive = (days > 0)

            await db.collection("subscriptions").findOneAndUpdate({
                "user._id": user._id
            }, {
                $set: updateObj
            })

            result.json({
                status: "success",
                message: "Data has been saved."
            })
        })

        router.post("/users/fetchSingle", authAdmin, async function (request, result) {
            const _id = request.fields._id
            const currentTimestamp = new Date().getTime()

            if (!_id) {
                result.json({
                    status: "error",
                    message: "Please fill all fields."
                })
                return
            }

            if (!ObjectId.isValid(_id)) {
                result.json({
                    status: "error",
                    message: "Invalid User ID."
                })
                return
            }

            const user = await db.collection("users").findOne({
                _id: ObjectId(_id)
            })

            if (user == null) {
                result.json({
                    status: "error",
                    message: "User does not exists."
                })

                return
            }

            const subscription = await db.collection("subscriptions")
                .findOne({
                    $and: [{
                        "user._id": user._id                        
                    }, {
                        isActive: true
                    }]
                })

            if (subscription != null) {
                let days = subscription.expireOn - currentTimestamp
                days = days / 1000 / 60 / 60 / 24
                days = Math.ceil(days)
                subscription.days = days
            }
            user.subscription = subscription

            result.json({
                status: "success",
                message: "Data has been fetched.",
                data: user
            })
        })

        router.get("/users/edit/:_id", function (request, result) {
            const _id = request.params._id || ""
            result.render("admin/users/edit", {
                _id: _id
            })
        })

        router.get("/users", function (request, result) {
            result.render("admin/users/index")
        })

        router.post("/users/unban", async function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            var admin = await db.collection("admins").findOne({
                "accessToken": accessToken
            });
            if (admin == null) {
                result.json({
                    "status": "error",
                    "message": self.logoutMessage
                });

                return false;
            }

            var user = await db.collection("users").findOne({
                "_id": ObjectId(_id)
            });
            if (user == null) {
                result.json({
                    "status": "error",
                    "message": "User does not exists."
                });

                return false;
            }

            await db.collection("users").findOneAndUpdate({
                "_id": ObjectId(_id)
            }, {
                $set: {
                    "isBanned": false
                }
            });

            result.json({
                "status": "success",
                "message": "User has been unbanned."
            });
        });

        router.post("/users/ban", async function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            var admin = await db.collection("admins").findOne({
                "accessToken": accessToken
            });
            if (admin == null) {
                result.json({
                    "status": "error",
                    "message": self.logoutMessage
                });

                return false;
            }

            var user = await db.collection("users").findOne({
                "_id": ObjectId(_id)
            });
            if (user == null) {
                result.json({
                    "status": "error",
                    "message": "User does not exists."
                });

                return false;
            }

            await db.collection("users").findOneAndUpdate({
                "_id": ObjectId(_id)
            }, {
                $set: {
                    "isBanned": true
                }
            });

            result.json({
                "status": "success",
                "message": "User has been banned."
            });
        });

        router.post("/users/delete", async function (request, result) {
            var accessToken = request.fields.accessToken;
            var _id = request.fields._id;

            var admin = await db.collection("admins").findOne({
                "accessToken": accessToken
            });
            if (admin == null) {
                result.json({
                    "status": "error",
                    "message": self.logoutMessage
                });

                return false;
            }

            var user = await db.collection("users").findOne({
                "_id": ObjectId(_id)
            });
            if (user == null) {
                result.json({
                    "status": "error",
                    "message": "User does not exists."
                });

                return false;
            }

            if (user.profileImage != "") {
                self.fileSystem.unlink(user.profileImage, function (error) {
                    console.log("error deleting file: " + error);
                });
            }

            if (user.coverPhoto != "") {
                self.fileSystem.unlink(user.coverPhoto, function (error) {
                    console.log("error deleting file: " + error);
                });
            }

            await db.collection("users").deleteOne({
                "_id": ObjectId(_id)
            });

            result.json({
                "status": "success",
                "message": "User has been deleted."
            });
        });

        router.post("/users/fetch", async function (request, result) {

            var accessToken = request.fields.accessToken;
            var skip = parseInt(request.fields.skip);
            var limit = parseInt(request.fields.limit);

            var admin = await db.collection("admins").findOne({
                "accessToken": accessToken
            });
            if (admin == null) {
                result.json({
                    "status": "error",
                    "message": self.logoutMessage
                });

                return false;
            }

            var users = await db.collection("users")
                .find({})
                .skip(skip)
                .limit(limit)
                .sort({
                    "_id": -1
                })
                .toArray();

            for (var a = 0; a < users.length; a++) {
                delete users[a].password;
            }

            var totalPages = await db.collection("users").count() / limit;
            totalPages = Math.ceil(totalPages);

            result.json({
                "status": "success",
                "message": "Data has been fetched.",
                "data": users,
                "totalPages": totalPages
            });
        });

        router.post("/getDashboardData", async function (request, result) {

            var accessToken = request.fields.accessToken;

            var admin = await db.collection("admins").findOne({
                "accessToken": accessToken
            });
            if (admin == null) {
                result.json({
                    "status": "error",
                    "message": self.logoutMessage
                });

                return false;
            }

            var users = await db.collection("users").count();
            
            result.json({
                "status": "success",
                "message": "Data has been fetched.",
                "users": users
            });
        });

        router.get("/", function (request, result) {
            db.collection("admins").findOne({}, function (error, admin) {
                if (!admin) {
                    bcryptjs.genSalt(10, function(err, salt) {
                        bcryptjs.hash(adminPassword, salt, async function(err, hash) {
                            db.collection("admins").insertOne({
                                "email": adminEmail,
                                "password": hash
                            })
                        })
                    })
                }
            });

            result.render("admin/index");
        });

        router.get("/login", function (request, result) {
            result.render("admin/login");
        });

        router.post("/login", async function (request, result) {

            var email = request.fields.email;
            var password = request.fields.password;

            var admin = await db.collection("admins").findOne({
                "email": email
            });

            if (admin == null) {
                result.json({
                    "status": "error",
                    "message": "Email does not exist"
                });

                return false;
            }

            bcryptjs.compare(password, admin.password, async function (error, res) {
                if (res === true) {

                    var accessToken = jwt.sign({ email: email }, accessTokenSecret);
                    await db.collection("admins").findOneAndUpdate({
                        "email": email
                    }, {
                        $set: {
                            "accessToken": accessToken
                        }
                    });

                    result.json({
                        "status": "success",
                        "message": "Login successfully",
                        "accessToken": accessToken
                    });
                    
                } else {
                    result.json({
                        "status": "error",
                        "message": "Password is not correct"
                    });
                }
            });
        });

        router.post("/getAdmin", async function (request, result) {
            var accessToken = request.fields.accessToken;
            
            var admin = await db.collection("admins").findOne({
                "accessToken": accessToken
            });

            if (admin == null) {
                result.json({
                    "status": "error",
                    "message": "User has been logged out. Please login again."
                });

                return false;
            }

            result.json({
                "status": "success",
                "message": "Record has been fetched.",
                "data": admin
            });
        });

        app.use("/admin", router)

    }
};