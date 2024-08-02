const express = require('express'); 
const mysql = require('mysql'); 
const multer = require('multer'); 
const bodyParser = require('body-parser'); // Import the body-parser module for parsing request bodies
const app = express(); 
const port = 3000; 
const path = require('path'); // Import the path module for handling file and directory paths

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/img'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Save the file with its original name
    }
});
const upload = multer({ storage: storage }); // Initialize multer with the defined storage settings

// Create MySQL connection
const connection = mysql.createConnection({
    // host: 'localhost',
    // user: 'root',
    // password: '',
    // database: 'simple_recipe_book' // Database name
    host: 'alwaysdata.com',
    user: 'trina1',
    password: ' ',
    database: 'trina1_miniproject'
});

// Connect to MySQL database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine and static files
app.set('view engine', 'ejs'); // Set the view engine to EJS
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files from the 'public' directory
app.use(express.urlencoded({ extended: false })); // Parse URL-encoded bodies

// Middleware to pass session data to views
app.use((req, res, next) => {
    res.locals.session = req.session; // Make session data available in views
    next(); // Continue to the next middleware
});

// Home route
app.get('/', (req, res) => {
    connection.query('SELECT * FROM recipes', (error, results) => {
        if (error) throw error;
        res.render('index', { recipes: results }); // Render the 'index' view with the recipes data
    });
});

// Search route
app.get('/search', (req, res) => {
    const query = req.query.query; // Get the search query from the request
    const sql = 'SELECT * FROM recipes WHERE titles LIKE ?';
    connection.query(sql, ['%' + query + '%'], (error, results) => {
        if (error) throw error;
        res.render('index', { recipes: results }); // Render the 'index' view with the search results
    });
});

// Route to get recipe by ID
app.get('/recipesDetails/:id', (req, res) => {
    const recipeid = req.params.id; // Get the recipe ID from the request parameters
    const sql = 'SELECT * FROM recipes WHERE recipeid = ?';
    connection.query(sql, [recipeid], (error, result) => {
        if (error) {
            console.error('Error retrieving recipe:', error);
            res.status(500).send('Error retrieving recipe');
            return;
        }
        if (result.length === 0) {
            res.status(404).send('Recipe not found');
            return;
        }

        const recipe = result[0];

        // Fetch the rating for the recipe
        const ratingSql = 'SELECT rating FROM ratings WHERE recipeid = ?';
        connection.query(ratingSql, [recipeid], (ratingError, ratingResult) => {
            if (ratingError) {
                console.error('Error retrieving rating:', ratingError);
                res.status(500).send('Error retrieving rating');
                return;
            }

            const currentRating = ratingResult.length > 0 ? ratingResult[0].rating : null;
            res.render('recipesDetails', { recipe, currentRating }); // Render the 'recipesDetails' view with the recipe and rating data
        });
    });
});

// Route to add or update a rating
app.post('/recipesDetails/:id/rate', (req, res) => {
    const recipeid = req.params.id; // Get the recipe ID from the request parameters
    const rating = req.body.rating; // Get the rating from the request body

    const checkSql = 'SELECT ratingid FROM ratings WHERE recipeid = ?';
    connection.query(checkSql, [recipeid], (checkError, checkResult) => {
        if (checkError) {
            console.error('Error checking rating:', checkError);
            res.status(500).send('Error checking rating');
            return;
        }

        if (checkResult.length > 0) {
            // Update existing rating
            const updateSql = 'UPDATE ratings SET rating = ? WHERE recipeid = ?';
            connection.query(updateSql, [rating, recipeid], (updateError, updateResult) => {
                if (updateError) {
                    console.error('Error updating rating:', updateError);
                    res.status(500).send('Error updating rating');
                    return;
                }
                res.redirect(`/recipesDetails/${recipeid}`); // Redirect to the recipe details page
            });
        } else {
            // Add new rating
            const insertSql = 'INSERT INTO ratings (recipeid, rating) VALUES (?, ?)';
            connection.query(insertSql, [recipeid, rating], (insertError, insertResult) => {
                if (insertError) {
                    console.error('Error adding rating:', insertError);
                    res.status(500).send('Error adding rating');
                    return;
                }
                res.redirect(`/recipesDetails/${recipeid}`); // Redirect to the recipe details page
            });
        }
    });
});

// Route to add a new recipe
app.get('/newRecipes', (req, res) => {
    res.render('newRecipes'); // Render the 'newRecipes' view
});

app.post('/newRecipes', upload.single('image'), (req, res) => {
    const { titles, ingredients, instructions, categories } = req.body; // Get the recipe data from the request body
    let image = req.file ? req.file.filename : null; // Get the uploaded image filename if available
    const sql = 'INSERT INTO recipes (titles, ingredients, instructions, categories, images) VALUES (?, ?, ?, ?, ?)';
    connection.query(sql, [titles, ingredients, instructions, categories, image], (error, results) => {
        if (error) {
            console.error('Error adding recipe:', error);
            res.status(500).send('Error adding recipe');
        } else {
            res.redirect('/'); // Redirect to the home page
        }
    });
});

// Route to edit a recipe
app.get('/recipes/edit/:id', (req, res) => {
    const sql = 'SELECT * FROM recipes WHERE recipeid = ?';
    connection.query(sql, [req.params.id], (err, result) => {
        if (err) throw err;
        res.render('editRecipes', { recipe: result[0] }); // Render the 'editRecipes' view with the recipe data
    });
});

app.post('/recipes/edit/:id', upload.single('image'), (req, res) => {
    const { titles, ingredients, instructions, categories } = req.body; // Get the updated recipe data from the request body
    let image = req.file ? req.file.filename : req.body.currentImage; // Get the updated image filename if available
    const sql = 'UPDATE recipes SET titles = ?, ingredients = ?, instructions = ?, categories = ?, images = ? WHERE recipeid = ?';
    connection.query(sql, [titles, ingredients, instructions, categories, image, req.params.id], (err, result) => {
        if (err) throw err;
        res.redirect(`/recipesDetails/${req.params.id}`); // Redirect to the recipe details page
    });
});

// Route to delete a recipe
app.post('/recipes/delete/:id', (req, res) => {
    const sql = 'DELETE FROM recipes WHERE recipeid = ?';
    connection.query(sql, [req.params.id], (err, result) => {
        if (err) throw err;
        res.redirect('/recipes'); // Redirect to the recipes list page
    });
});

// Route to add a recipe to favourites
app.post('/recipes/add/:id', (req, res) => {
    const recipeid = req.params.id; // Get the recipe ID from the request parameters
    const sql = 'INSERT INTO favourites (recipeid) VALUES (?)';
    connection.query(sql, [recipeid], (error, results) => {
        if (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                // Duplicate entry error
                res.status(400).send('Recipe is already in favourites');
            } else {
                console.error('Error adding favourite:', error);
                res.status(500).send('Error adding favourite');
            }
        } else {
            res.redirect('/myrecipes'); // Redirect to the favourites list page
        }
    });
});

// Route to view favourite recipes
app.get('/myrecipes', (req, res) => {
    const sql = 'SELECT recipes.* FROM recipes JOIN favourites ON recipes.recipeid = favourites.recipeid';
    connection.query(sql, (error, results) => {
        if (error) {
            console.error('Error retrieving favourites:', error);
            res.status(500).send('Error retrieving favourites');
        } else {
            res.render('myrecipes', { recipes: results }); // Render the 'myrecipes' view with the favourite recipes data
        }
    });
});

// Route to delete a recipe from favourites
app.post('/favourites/delete/:id', (req, res) => {
    const recipeid = req.params.id; // Get the recipe ID from the request parameters
    const sql = 'DELETE FROM favourites WHERE recipeid = ?';
    connection.query(sql, [recipeid], (error, results) => {
        if (error) {
            console.error('Error deleting favourite:', error);
            res.status(500).send('Error deleting favourite');
        } else {
            res.redirect('/myrecipes'); // Redirect to the favourites list page
        }
    });
});

// Route to display comments for a recipe
app.get('/comments/:id', (req, res) => {
    const recipeid = req.params.id; // Get the recipe ID from the request parameters
    const recipeSql = 'SELECT * FROM recipes WHERE recipeid = ?';
    const commentSql = 'SELECT * FROM comments WHERE recipeid = ? ORDER BY created_at DESC';
    connection.query(recipeSql, [recipeid], (recipeError, recipeResult) => {
        if (recipeError) {
            console.error('Error retrieving recipe:', recipeError);
            res.status(500).send('Error retrieving recipe');
            return;
        }
        if (recipeResult.length === 0) {
            res.status(404).send('Recipe not found');
            return;
        }
        connection.query(commentSql, [recipeid], (commentError, commentResults) => {
            if (commentError) {
                console.error('Error retrieving comments:', commentError);
                res.status(500).send('Error retrieving comments');
                return;
            }
            res.render('comments', { recipe: recipeResult[0], comments: commentResults }); // Render the 'comments' view with the recipe and comments data
        });
    });
});

// Route to get all comments
app.get('/mycomments', (req, res) => {
    const sql = `
        SELECT comments.commentid, comments.recipeid, comments.comment, comments.created_at, recipes.titles 
        FROM comments 
        JOIN recipes ON comments.recipeid = recipes.recipeid 
        ORDER BY comments.created_at DESC
    `;
    connection.query(sql, (error, result) => {
        if (error) {
            console.error('Error retrieving comments:', error);
            res.status(500).send('Error retrieving comments');
            return;
        }

        const comments = result;
        res.render('mycomments', { comments }); // Render the 'mycomments' view with the comments data
    });
});

// Route to add a comment
app.post('/comments/add/:id', (req, res) => {
    const recipeid = req.params.id; // Get the recipe ID from the request parameters
    const { comment } = req.body; // Get the comment from the request body
    const sql = 'INSERT INTO comments (recipeid, comment) VALUES (?, ?)';
    connection.query(sql, [recipeid, comment], (error, results) => {
        if (error) {
            console.error('Error adding comment:', error);
            res.status(500).send('Error adding comment');
        } else {
            res.redirect(`/comments/${recipeid}`); // Redirect to the comments page for the recipe
        }
    });
});

// Route to delete a comment
app.post('/comments/delete/:commentid', (req, res) => {
    const commentid = req.params.commentid; // Get the comment ID from the request parameters
    const recipeid = req.body.recipeid; // Get the recipe ID from the request body

    const sql = 'DELETE FROM comments WHERE commentid = ?';
    connection.query(sql, [commentid], (error, result) => {
        if (error) {
            console.error('Error deleting comment:', error);
            res.status(500).send('Error deleting comment');
            return;
        }
        res.redirect(`/mycomments`); // Redirect to the comments list page
    });
});

// Route to render edit comment page
app.get('/comments/edit/:commentid', (req, res) => {
    const commentid = req.params.commentid; // Get the comment ID from the request parameters

    const sql = 'SELECT * FROM comments WHERE commentid = ?';
    connection.query(sql, [commentid], (error, result) => {
        if (error) {
            console.error('Error retrieving comment:', error);
            res.status(500).send('Error retrieving comment');
            return;
        }
        if (result.length === 0) {
            res.status(404).send('Comment not found');
            return;
        }

        const comment = result[0];
        res.render('editcomments', { comment }); // Render the 'editcomments' view with the comment data
    });
});

// Route to update a comment
app.post('/comments/edit/:commentid', (req, res) => {
    const commentid = req.params.commentid; // Get the comment ID from the request parameters
    const comment = req.body.comment; // Get the updated comment from the request body
    const recipeid = req.body.recipeid; // Get the recipe ID from the request body

    const sql = 'UPDATE comments SET comment = ? WHERE commentid = ?';
    connection.query(sql, [comment, commentid], (error, result) => {
        if (error) {
            console.error('Error updating comment:', error);
            res.status(500).send('Error updating comment');
            return;
        }
        res.redirect(`/mycomments`); // Redirect to the comments list page
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
