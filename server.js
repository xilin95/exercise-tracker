const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const moment = require('moment')
var assert = require('assert')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' );

var userSchema = mongoose.Schema({
  userName: {
    type: String,
    required: true,
    unique: true
  },
  userID: String,
  exerciseId:[String]
});

var exerciseSchema = mongoose.Schema({
  userId: String,
  exerciseId: String,
  description: String,
  duration: Number,
  date: Date
});

var newUser = mongoose.model('newUser', userSchema);
var newExercise = mongoose.model('newExercise', exerciseSchema);



app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', (req, res) => {
  
  var uniqueID = generateID();
  var userName = req.body.username;
  
  var user = new newUser({ userName: userName, userID: uniqueID });

  newUser.init().then(function() {
    newUser.create(user, (error) => {
      // Will error, but will *not* be a mongoose validation error, it will be
      // a duplicate key error.
      if(error && error.message.indexOf('duplicate key error') !== -1) {
        res.send("username already taken");
      } else if (userName.length < 1) {
        res.send("Path `username` is required.");
      } else {
        res.json({ userName: userName, userID: uniqueID });
      }      
    });
  });
  
});

app.post("/api/exercise/add", (req, res, done) => {
  
  var userId = req.body.userId;
  var exerciseId = generateID();
  var description = req.body.description;
  var duration = req.body.duration;
  var date = req.body.date == '' ? new Date() : req.body.date;
  var userName = '';
  
  function callback(result) {
    console.log(arguments);
    if(!result) {
      res.send("unknown _id");
      return;
    }
    if (description.length < 1) {
      res.send("Path `description` is required.");
    } else if (description.length > 100) {
      res.send("description too long");
    } else if (duration.length < 1) {
      res.send("Path `duration` is required.");
    } else if (isNaN(Number(duration))) {
      res.send("Cast to Number failed for value \"" + duration + "\" at path \"duration\"");
    } else if (date !== '' && isNaN(Date.parse(date))) {
      res.send("Cast to Date failed for value \"" + date + "\" at path \"date\"");
    } else {
      date = new Date(date);
      userName = result.userName;
      newUser.findOneAndUpdate({ userID: userId }, {"$push": { "exerciseId": exerciseId}}, {"new": true}, (err, data) => {
        if (err) res.send("cannot save exercise");
        return;
      })

      var exercise = new newExercise({ userId: userId, exerciseId: exerciseId, description: description, duration: duration, date: date.toDateString() });

      exercise.save((err, date) => { if(err) res.send('error saving the exercise'); });
      res.json({ username: userName, description: description, duration: duration, _id: exerciseId, date: date });
    }
  
  };

//   var userExist = new Promise((resolve, reject) => {
//     var user = ;
    
//     if (user !== null) {
//       console.log("user is not null");
//       userName = user.userName;
//       resolve(true);
//     } else {
//       res.send("unknown _id");
//       reject(false);
//     }

//   }); 
  
  findUser(userId).then(callback);
  
});

app.get('/api/exercise/log', (req, res) => {
  console.log("here");
  
  console.log(req.query);
  
  getExercise(req, res);
  
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

var generateID = function () {
  // Math.random should be unique because of its seeding algorithm.
  // Convert it to base 36 (numbers + letters), and grab the first 9 characters
  // after the decimal.
  return '_' + Math.random().toString(36).substr(2, 9);
};

function findUser(userId) {
  return newUser.findOne({ userID: userId });
}

function getExercise(req, res) {
  var userId = req.query.userId;
  console.log(userId);
  
  let query = {
    userId: userId
  }
  
  if (req.query.from || req.query.to) {
    query.date = {};
    if (req.query.from) {
      query.date.$gte = moment(req.query.from).format('YYYY-MM-DD');
    }
    
    if (req.query.to) {
      query.date.$lte = moment(req.query.to).format('YYYY-MM-DD');
    } 
  }
  
  newExercise.find(query).limit(parseInt(req.query.limit)).then(result => res.json(result)).catch(error => res.send("err"));
}

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
