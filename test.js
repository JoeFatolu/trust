// database module
const mongodb = require("mongodb")
 
// client used to connect with database
const MongoClient = mongodb.MongoClient
 
// each Mongo document's unique ID
const ObjectId = mongodb.ObjectId

const globals = require("./modules/globals")

const urlMetadata = require("url-metadata")

// connect with database
MongoClient.connect(connectionString, async function (error, client) {
    if (error) {
        console.error(error)
        return
    }

    // database name
    global.db = client.db("trustpilot")
    console.log("Database connected")

    // const metadata = await urlMetadata("https://facebook.com")
    // console.log(metadata)

    /*fetch("https://facebook.com")
        .then(result => result.text())
        .then(html => {
            console.log(html);
        }).catch(error => {
            console.log(error);
        })*/

    /*db.collection("reviews")
        .countDocuments({
            "company._id": ObjectId("658bcb120c405536a88b9007")
        }, function (error, data) {
            console.log(data)
        })*/

    /*db.collection("reviews")
        .aggregate([
            {
                $match: {
                    "company._id": ObjectId("658bcb120c405536a88b9007")
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
        ]).toArray(function (error, data) {
            console.log(data)
        })*/
})