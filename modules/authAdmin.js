module.exports = async function (request, result, next) {
	const accessToken = request.fields.accessToken

    const admin = await db.collection("admins").findOne({
        $and: [{
            accessToken: {
                $exists: true
            }
        }, {
            accessToken: accessToken
        }]
    })
    
    if (admin == null) {
        result.json({
            status: "error",
            message: "Admin has been logged out. Please login again."
        })
        return
    }

    request.admin = admin
    next()
}