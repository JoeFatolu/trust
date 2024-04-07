const nodemailer = require("nodemailer")

global.adminEmail = "admin@gmail.com"
global.adminPassword = "admin"

// secret JWT key
global.jwtSecret = "jwtSecret1234567890"
global.accessTokenSecret = "myAdminAccessTokenSecret1234567890"
global.mainURL = "http://localhost:3000"
global.connectionString = "mongodb+srv://apparise:nGbnHPBNX0GFkif1@cluster0-apbmr.mongodb.net/trustdec?retryWrites=true&authSource=admin"

global.nodemailerFrom = "support@adnan-tech.com"
global.transport = nodemailer.createTransport({
    host: "",
    port: 465,
    secure: true,
    auth: {
        user: nodemailerFrom,
        pass: ""
    }
})

module.exports = {

    categories: [
        { title: "Bank", keywords: ["bank", "finance", "money"], icon: "fa fa-bank" },
        { title: "Travel Insurance Company", keywords: ["travel", "insurance"], icon: "fa fa-plane" },
        { title: "Car Dealer", keywords: ["car", "vehicle", "motor"], icon: "fa fa-car" },
        { title: "Furniture Store", keywords: ["furniture", "house"], icon: "fa fa-bed" },
        { title: "Jewelry Store", keywords: ["jewelry"], icon: "fa fa-diamond" },
        { title: "Clothing Store", keywords: ["cloth", "dress", "wear"], icon: "fa fa-shopping-cart" },
        { title: "Electronics & Technology", keywords: ["electronics", "tech", "mobile", "laptop", "gadgets", "programming", "coding", "php", "python", "java"], icon: "fa fa-laptop" },
        { title: "Fitness & Nutrition Centre", keywords: ["fitness", "nutrition", "gym", "exercise"], icon: "fa fa-stethoscope" },
    ],

    relativeReview(stars) {
        if (stars >= 5) {
            return "Excellent"
        }
        if (stars >= 4) {
            return "Great"
        }
        if (stars >= 3) {
            return "Average"
        }
        if (stars >= 2) {
            return "Poor"
        }
        if (stars >= 1) {
            return "Bad"
        }
        return ""
    },

    getStarColorRGB(stars) {
        let color = this.getStarColor(stars)
        if (color == "yellow") { return "rgb(255, 206, 0)" }
        if (color == "orange") { return "rgb(255, 134, 34)" }
        if (color == "pale-green") { return "rgb(115, 207, 17)" }
        if (color == "green") { return "rgb(0, 182, 122)" }
        if (color == "red") { return "rgb(255, 55, 34)" }
        return color
    },

    getStarColor(stars) {
        let color = "green"
        if (stars == 4) {
            color = "pale-green"
        } else if (stars == 3) {
            color = "yellow"
        } else if (stars == 3) {
            color = "yellow"
        } else if (stars == 2) {
            color = "orange"
        } else if (stars == 1) {
            color = "red"
        }
        return color
    },

    prependHttp (url) {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'http://' + url;
        }
        return url;
    }
}