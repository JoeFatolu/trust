// database module
const mongodb = require("mongodb")

// client used to connect with database
const MongoClient = mongodb.MongoClient

const connectionString = "mongodb://localhost:27017"

// (async function () {

    // connect with database
    MongoClient.connect(connectionString, async function (error, client) {
        if (error) {
            console.error(error)
            return
        }
 
        // database name
        global.db = client.db("trustpilot")
        console.log("Database connected")

        const res = await db.collection("companies")
            .aggregate([
                {
                    $match: {
                        "company._id": ""
                    }
                },
                {
                    $group: {
                        _id: "$_id",
                        data: {
                            $sum: "$ratings"
                        }
                    }
                }
            ]).toArray()
        console.log(res)
    })
// })