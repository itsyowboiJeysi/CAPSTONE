const express = require('express');
const app = express();

app.set('view engine', 'ejs');         // tell Express to use EJS
app.set('views', './views');           // folder where your .ejs files live
app.use(express.static('public'));     // serve CSS/images from /public

app.get('/', (req, res) => {
  res.render('login');                 // renders views/login.ejs
});

app.get('/dashboard', (req, res) => {
    res.render('dashboard');
  });


app.get('/monitoring', (req, res) => {
    res.render('realtime-monitoring');
  });
  
app.get('/water-quality', (req, res) => {
    res.render('water-quality');
  });

  app.get('/consumption', (req, res) => {
    res.render('consumption');
  });

  app.get('/alerts', (req, res) => {
    res.render('alerts');
  });

  app.get('/history', (req, res) => {
    res.render('history');
  });

  app.get('/reports', (req, res) => {
    res.render('reports');
  });
app.use(express.urlencoded({ extended: true })); // parse form data

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (email === 'admin@etubig.com' && password === 'secret123') {
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: 'Invalid credentials' });
  }
});
app.listen(3000);