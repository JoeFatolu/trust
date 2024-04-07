const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]

const ReviewComponent = {
    template: `<div class="card card-body" style="padding-left: 0px; margin-top: 10px;">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-1">
                    <img v-bind:src="mainURL + '/userProfileImage/' + review.user._id"
                        style="width: 50px; height: 50px; object-fit: cover; border-radius: 50%;" />
                </div>

                <div class="col-md-6 margin-top-mobile-20">
                    <p style="margin-bottom: 0px; font-weight: bold;" v-text="review.user.name"></p>
                    <p style="color: gray;">
                        <span v-text="review.user.reviews"></span> reviews

                        <span style="margin-left: 10px;">
                            <i class="fa fa-map-marker"></i>&nbsp;
                            <span v-text="review.user.location"></span>
                        </span>
                    </p>
                </div>

                <div class="col-md-5">
                    <span v-text="getDateFormat(new Date(review.createdAt + ' UTC'))"></span>
                </div>
            </div>

            <div class="row">
                <div class="col-md-12">
                    <hr style="background-color: #b7b7b7;" />

                    <div class="stars">
                        <i v-for="i in 5" v-bind:class="'fa fa-star star ' + (i > review.ratings ? 'initial' : getStarColor(review.ratings))"
                            style="font-size: 16px;"></i>
                    </div>

                    <h3 v-text="review.title"></h3>
                    <p v-text="review.review"></p>
                    <p v-if="review.dateOfExperience">
                        <b>Date of experience: </b>
                        <span v-text="getDateFormat(new Date(review.dateOfExperience))"></span>
                    </p>

                    <div style="margin-top: 50px;" v-if="review.images?.length > 0">
                        <h5>Images</h5>
                        <img v-for="image in review.images" v-bind:src="image" style="width: 150px; margin-right: 5px; margin-top: 5px;" />
                    </div>

                    <div v-if="review.videos?.length > 0">
                        <h5>Videos</h5>
                        <video v-for="video in review.videos" v-bind:src="video" style="width: 300px; margin-right: 5px; margin-top: 5px;" controls></video>
                    </div>

                    <template v-if="user != null && review.user._id.toString() == user._id.toString()">
                        <hr style="background-color: #b7b7b7;" />

                        <button type="button" id="btn-delete" v-on:click="deleteReview">
                            <i class="fa fa-trash"></i>
                            <span>Delete</span>
                        </button>
                    </template>
                </div>
            </div>

            <div class="row" style="border-top: 1px solid lightgray;
                padding-top: 10px;">
                <div class="col-2">
                    <div v-html="getUseful()"></div>
                </div>

                <div class="col-2">
                    <div class="dropdown">
                        <button class="btn btn-link btn-share dropdown-toggle" type="button" v-bind:id="'dropdownMenuButton-share-' + review._id" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                            <i class='fa fa-share'></i>
                            Share
                        </button>

                        <div class="dropdown-menu" v-bind:aria-labelledby="'dropdownMenuButton-share-' + review._id">
                            <a class="dropdown-item" v-bind:href="'https://www.facebook.com/sharer/sharer.php?u=http://localhost:3000/review/' + review._id" target="_blank">Facebook</a>
                            <a class="dropdown-item" v-bind:href="'http://twitter.com/share?text=Check this review:&url=http://localhost:3000/review/' + review._id" target="_blank">Twitter</a>
                        </div>
                    </div>
                </div>

                <div class="col-2" v-if="review.isMyClaimed">
                    <a v-bind:href="mainURL + '/companies/reply/' + review._id" class="btn btn-link" style="color: black; text-decoration: none;">
                        <i class='fa fa-reply'></i>
                        &nbsp;Reply
                    </a>
                </div>

                <div class="col-2">
                    <div v-html="getFlag()"></div>
                </div>
            </div>

            <div class="row" v-if="review.replies.length > 0">
                <div class="col-md-12">
                    <h3>Repllies</h3>
                </div>
            </div>

            <div class="row" v-for="reply of review.replies">
                <div class="col-md-12">
                    <p v-html="reply.reply"></p>
                </div>
            </div>
        </div>
    </div>`,

    props: {
        // Define a prop named 'review' of type Object
        review: {
            type: Object,
            required: true // This prop is required
        },
        // Define a prop named 'isMyClaimed' of type Boolean
        isMyClaimed: {
            type: Boolean,
            required: true // This prop is required
        }
    },

    data() {
        return {
            mainURL: mainURL,
            getStarColor: getStarColor,
            user: null,
            getDateFormat: getDateFormat
        }
    },

    methods: {

        shareToWA(_id) {
            // Define the content you want to share
            const shareText = 'Check out this review!';
            const shareUrl = 'http://localhost:3000/review/' + _id;
            // Create the WhatsApp share URL
            const whatsappUrl = 'whatsapp://send?text=' + encodeURIComponent(shareText) + '%20$' + encodeURIComponent(shareUrl)
            // Open WhatsApp with the share URL
            window.location.href = whatsappUrl;
        },

        getFlag() {
            if (user == null) {
                return ''
            }

            return `<button type='button' class="btn btn-link btn-flag" onclick="toggleFlag('` + this.review._id + `')">
                <i class='fa fa-flag'></i>
                Flag
                <span data-review-flags="` + this.review._id + `">` + this.review.flags.length + `</span>
            </button>`
        },

        getUseful() {
            if (user == null) {
                return ''
            }

            return `<button type='button' class="btn btn-link btn-useful" onclick="toggleUseful('` + this.review._id + `')">
                <i class='fa fa-thumbs-up'></i>
                Useful
                <span data-review-usefuls="` + this.review._id + `">` + this.review.usefuls.length + `</span>
            </button>`
        }
    }
}

function getDateFormat(date) {
    date = date.getDate() + " " + months[date.getMonth()] + ", " + date.getFullYear()
    return date
}

async function toggleFlag(reviewId) {
    try {
        const formData = new FormData()
        formData.append("reviewId", reviewId)

        const response = await axios.post(
            mainURL + "/companies/toggleFlagReview",
            formData,
            {
                headers: {
                    Authorization: "Bearer " + localStorage.getItem("accessToken")
                }
            }
        )

        if (response.data.status == "success") {
            const feedback = response.data.feedback
            const node = document.querySelector("span[data-review-flags='" + reviewId + "']")
            let count = parseFloat(node.innerHTML)
            node.innerHTML = ++count
        } else {
            swal.fire("Error", response.data.message, "error")
        }
    } catch (exp) {
        swal.fire("Error", exp.message, "error")
    }
}

async function toggleUseful(reviewId) {
    try {
        const formData = new FormData()
        formData.append("reviewId", reviewId)

        const response = await axios.post(
            mainURL + "/companies/toggleUsefulReview",
            formData,
            {
                headers: {
                    Authorization: "Bearer " + localStorage.getItem("accessToken")
                }
            }
        )

        if (response.data.status == "success") {
            const feedback = response.data.feedback
            const node = document.querySelector("span[data-review-usefuls='" + reviewId + "']")
            let count = parseFloat(node.innerHTML)

            if (feedback) {
                count++
            } else {
                count--
            }
            node.innerHTML = count
        } else {
            swal.fire("Error", response.data.message, "error")
        }
    } catch (exp) {
        swal.fire("Error", exp.message, "error")
    }
}

function onmouseenterStar(star) {
    try {
        const nodes = document.querySelectorAll(".rating-stars")
        for (let a = 0; a < nodes.length; a++) {
            let element = nodes[a].children[0]
            element.className = "fa fa-star star"
        }
        for (let a = 1; a <= star; a++) {
            let color = getStarColor(star)
            if (a > star) {
                color = "initial"
            }

            let element = nodes[a - 1].children[0]
            element.className = "fa fa-star star " + color
        }
    } catch (exp) {
        console.log(exp)
    }
}

function relativeReview(stars) {
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
}

function getStarColor(stars) {
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
}