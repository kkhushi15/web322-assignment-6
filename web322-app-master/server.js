/*********************************************************************************
* WEB322 – Assignment 06
* I declare that this assignment is my own work in accordance with Seneca Academic Policy. No part
* of this assignment has been copied manually or electronically from any other source
* (including 3rd party web sites) or distributed to other students.
*
* Name: khushi    Student ID: 138004205    Date: April 8, 2022
*
* Online (Heroku) Link: 
*
********************************************************************************/



const express = require("express");
const exphbs = require("express-handlebars");
const authData = require("./auth-service.js");
const multer = require("multer");
const upload = multer();
const cloudinary = require('cloudinary').v2
const streamifier = require('streamifier');
const path = require("path");
const app = express();
const blogservice = require("./blog-service.js");
const blogData = require("./blog-service");
const { rmSync } = require("fs");
const stripJs = require('strip-js');
const clientSessions = require("client-sessions");


const HTTP_PORT = process.env.PORT || 8080;

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));


// Assignment 6

app.use(clientSessions( {
    cookieName: "session",
    secret: "web322_a6",
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60
}));

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});

function ensureLogin(req, res, next) {
    if (!req.session.user) {
      res.redirect("/login");
    } else {
      next();
    }
}


app.engine(".hbs", exphbs.engine({
    extname: ".hbs",
    helpers: {
        navLink: function (url, options) {
            return '<li' +
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') +
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        },
        safeHTML: function (context) {
            return stripJs(context);
        },
        formatDate: function (dateObj) {
            let year = dateObj.getFullYear();
            let month = (dateObj.getMonth() + 1).toString();
            let day = dateObj.getDate().toString();
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
}));


app.set("view engine", ".hbs");


app.use(function (req, res, next) {
    let route = req.path.substring(1);
    app.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
    app.locals.viewingCategory = req.query.category;
    next();
});


// URL Main Pathway

app.get("/", (req, res) => {
    res.redirect('/blog');
});


// About

app.get("/about", (req, res) => {
    res.render(path.join(__dirname, "/views/about.hbs"));
});


// Posts/Add GET Route

app.get("/posts/add", ensureLogin, (req, res) => {
    blogservice.getCategories()
        .then(data => res.render("addPost", { categories: data }))
        .catch(err => {
            res.render("addPost", { categories: [] })
            console.log(err);
        });
});


// Categories/Add GET Route

app.get("/categories/add", ensureLogin, (req, res) => {
    res.render(path.join(__dirname, "/views/addCategory.hbs"));
});


// Categories/Add POST Route

app.post("/categories/add", ensureLogin, (req, res) => {
    blogservice.addCategory(req.body).then(() => {
        res.redirect("/categories");
    })
});


// Categories/Delete/:ID Route

app.get("/categories/delete/:id", ensureLogin, (req, res) => {
    blogservice.deleteCategoryById(req.params.id)
        .then(() => {
            res.redirect("/categories");
        }).catch(err => {
            res.status(500).send("Unable to Remove Category / Category not found");
            console.log(err);
        });
});


// Posts/Delete/:ID Route

app.get("/posts/delete/:id", ensureLogin, (req, res) => {
    blogservice.deletePostById(req.params.id)
        .then(() => {
            res.redirect("/posts");
        }).catch(err => {
            res.status(500).send("Unable to Remove Post / Post not found");
            console.log(err);
        });
});


// Cloudinary Connection Info (for uploading at 'Add Post' image)

cloudinary.config({
    cloud_name: 'senecacollege',
    api_key: '522221365446921',
    api_secret: '197mWcMeY-TuENq2HeEdFfQEQuQ',
    secure: true
  });

// Blog Route

app.get('/blog', async (req, res) => {

    // Declare an object to store properties for the view
    let viewData = {};

    try {

        // declare empty array to hold "post" objects
        let posts = [];

        // if there's a "category" query, filter the returned posts by category
        if (req.query.category) {
            // Obtain the published "posts" by category
            posts = await blogData.getPublishedPostsByCategory(req.query.category);
        } else {
            // Obtain the published "posts"
            posts = await blogData.getPublishedPosts();
        }

        // sort the published posts by postDate
        posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

        // get the latest post from the front of the list (element 0)
        let post = posts[0];

        // store the "posts" and "post" data in the viewData object (to be passed to the view)
        viewData.posts = posts;
        viewData.post = post;

    } catch (err) {
        viewData.message = "no results";
    }

    try {
        // Obtain the full list of "categories"
        let categories = await blogData.getCategories();

        // store the "categories" data in the viewData object (to be passed to the view)
        viewData.categories = categories;
    } catch (err) {
        viewData.categoriesMessage = "no results"
    }

    // render the "blog" view with all of the data (viewData)
    res.render("blog", { data: viewData })

});


// Posts Route

app.get("/posts", ensureLogin, (req, res) => {
    let category = req.query.category;
    let minDate = req.query.minDate;

    if (category) {
        blogservice.getPostsByCategory(category).then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            }
            else {
                res.render("posts", { message: "no results" });
            }
        })
    }
    else if (minDate != "" && minDate != null) {
        blogservice.getPostsByMinDate(minDate).then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            }
            else {
                res.render("posts", { message: "no results" });
            }
        })
    }
    else {
        blogservice.getAllPosts().then(data => {
            if (data.length > 0) {
                res.render("posts", { posts: data });
            }
            else {
                res.render("posts", { message: "no results" });
            }
        })
    }
});


// Categories Route

app.get("/categories", ensureLogin, (req, res) => {
    blogservice.getCategories().then(data => {
        if (data.length > 0) {
            res.render("categories", { categories: data });
        }
        else {
            res.render("categories", { message: "no results" });
        }
    })
});


// Posts/Add POST Route

app.post('/posts/add', upload.single("featureImage"), (req, res) => {
    if (req.file) {
        let streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                let stream = cloudinary.uploader.upload_stream(
                    (error, result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    }
                );

                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };

        async function upload(req) {
            let result = await streamUpload(req);
            console.log(result);
            return result;
        }

        upload(req).then((uploaded) => {
            processPost(uploaded.url);
        });
    } else {
        processPost("");
    }

    function processPost(imageUrl) {
        req.body.featureImage = imageUrl;

        // TODO: Process the req.body and add it as a new Blog Post before redirecting to /posts

        blogservice.addPost(req.body).then(() => {
            res.redirect("/posts");
        }).catch(err => {
            res.status(500).send(err);
        })
    }
});


// Post/:Value Route

app.get('/post/:value', ensureLogin, (req, res) => {
    blogservice.getPostById(req.params.value).then((data) => {
        res.render("post", { post: data })
    }).catch(err => {
        res.render("post", { message: "no results" });
    });
});


// Blog/:id Route

app.get('/blog/:id', ensureLogin, async (req, res) => {

    // Declare an object to store properties for the view
    let viewData = {};

    try {

        // declare empty array to hold "post" objects
        let posts = [];

        // if there's a "category" query, filter the returned posts by category
        if (req.query.category) {
            // Obtain the published "posts" by category
            posts = await blogData.getPublishedPostsByCategory(req.query.category);
        } else {
            // Obtain the published "posts"
            posts = await blogData.getPublishedPosts();
        }

        // sort the published posts by postDate
        posts.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));

        // store the "posts" and "post" data in the viewData object (to be passed to the view)
        viewData.posts = posts;

    } catch (err) {
        viewData.message = "no results";
    }

    try {
        // Obtain the post by "id"
        viewData.post = await blogData.getPostById(req.params.id);
        console.log(viewData.post)
    } catch (err) {
        viewData.message = "no results";
    }

    try {
        // Obtain the full list of "categories"
        let categories = await blogData.getCategories();

        // store the "categories" data in the viewData object (to be passed to the view)
        viewData.categories = categories;
    } catch (err) {
        viewData.categoriesMessage = "no results"
    }

    // render the "blog" view with all of the data (viewData)
    res.render("blog", { data: viewData })
});


// Login

app.get("/login", (req, res) => {
    res.render("login");
});


// Register

app.get("/register", (req, res) => {
    res.render("register");
});


app.post("/register", (req,res) => {
    authData.registerUser(req.body)
    .then(() => res.render("register", {successMessage: "User created" } ))
    .catch (err => res.render("register", {errorMessage: err, userName:req.body.userName }) )
});


app.post("/login", (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    authData.checkUser(req.body).then((user) => {
        req.session.user = {
            userName: user.userName,
            email: user.email,  
            loginHistory: user.loginHistory 
        }
        res.redirect('/posts');
    }).catch((err) => {
        res.render("login", {errorMessage: err, userName: req.body.userName});
    });
});


// Logout

app.get("/logout", (req, res) => {
    req.session.reset();
    res.redirect("/");
});


// User History

app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory");
});



// 404 Error Route

app.use((req, res) => {
    res.status(404).send("Page Not Found");
});


blogservice.initialize()
    .then(authData.initialize)
    .then(function () {
        app.listen(HTTP_PORT, function () {
            console.log("app listening on: " + HTTP_PORT)
        });
    }).catch(function (err) {
        console.log("unable to start server: " + err);
    }
);










