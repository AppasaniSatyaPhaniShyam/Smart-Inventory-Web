/**
 * @file app.js
 * The starting point of the application.
 * Express allows us to configure our app and use
 * dependency injection to add it to the http server.
 * 
 * The server-side app starts and begins listening for events.
 *
 */

// Module dependencies
const express = require('express')
const http = require('http')
const expressLayouts = require('express-ejs-layouts')
const favicon = require('serve-favicon')
const path = require('path')
const bodyParser = require('body-parser')
const engines = require('consolidate')
const session = require('express-session')
const errorHandler = require('errorhandler')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const expressValidator = require('express-validator')
const expressStatusMonitor = require('express-status-monitor')
const LOG = require('./utils/logger.js')
const user = require('./data/users.json')

// Load environment variables from .env file, where API keys and passwords are configured.
// dotenv.load({ path: '.env.example' })
dotenv.load({ path: '.env' })
LOG.info('Environment variables loaded.')

// default app variables
const DEFAULT_PORT = 8084 // use our section number

// set environment-specific values
const isProduction = process.env.NODE_ENV === 'production'
LOG.info('Environment isProduction = ', isProduction)
const isTest = process.env.NODE_ENV === 'test'
LOG.info('Environment isTest = ', isTest)

// global config files
global.ensureAuthenticated = require('./config/ensureAuthenticated')

// Connect to MongoDB............................
var url = process.env.MONGODB_URI

if (isProduction) {
  url = process.env.MONGODB_URI_ATLAS
  LOG.info('Production: Atlas MongoDB URL = ' + url)
} else {
  LOG.info('Development: Local MongoDB URL = ' + url)
}
// mongoose.connect(url)
var promise = mongoose.connect(url, {
  useMongoClient: true
  /* other options */
})
promise.then(function (db) {
  // initialize data ............................................
  require('./utils/seeder.js')(app)  // load seed data
})

mongoose.connection.once('open', function () {
  LOG.info('MongoDB event open')
  LOG.debug('MongoDB connected [%s]', url)

  mongoose.connection.on('connected', function () {
    LOG.info('MongoDB event connected')
  })

  mongoose.connection.on('disconnected', function () {
    LOG.warn('MongoDB event disconnected')
  })

  mongoose.connection.on('reconnected', function () {
    LOG.info('MongoDB event reconnected')
  })

  mongoose.connection.on('error', function (err) {
    LOG.error('%s Atlas MongoDB error: %s', chalk.red('✗'), err)
    process.exit(1)
  })
})

// create express app ..................................
const app = express()

// configure app.settings.............................
// app.set('port', process.env.PORT || DEFAULT_PORT)
if (isTest) {
  app.set('port', process.env.TESTPORT || DEFAULT_PORT)
} else {
  app.set('port', process.env.PORT || DEFAULT_PORT)
}

// set the root view folder
app.set('views', path.join(__dirname, 'views'))

// specify desired view engine
app.set('view engine', 'ejs')
app.engine('ejs', engines.ejs)

// configure middleware.....................................................
app.use(favicon(path.join(__dirname, '/public/images/favicon.ico')))
app.use(expressStatusMonitor())

// log calls
app.use((req, res, next) => {
    LOG.debug('%s %s', req.method, req.url)
    next()
})

// specify various resources and apply them to our application
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))
app.use(expressValidator())
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }))
app.use(expressLayouts)
app.use(errorHandler()) // load error handler

// setup passport authorization and authentication ...............................
// follow passport reference app
// add supporting packages to package.json

global.passport = require('passport')  // require passport
const MongoStore = require('connect-mongo')(session)  // require MongoStore
const flash = require('express-flash')  // require flash messaging
// const session = require('express-session') // already included above

app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET,
  store: new MongoStore({
    mongooseConnection: mongoose.connection,
    url: process.env.MONGODB_URI_ATLAS || process.env.MONGOLAB_URI,
    autoReconnect: true
  })
}))
app.use(global.passport.initialize())
app.use(global.passport.session())

app.use(flash())  // used for messages

app.use((req, res, next) => {
  res.locals.user = req.user  // pass in user with each request
  next()
})

// load routing...............................................

const routes = require('./routes/index.js')
const routesUser = require('./routes/user.js') // get user routes as well

app.use('/', routes) // load routing
app.use('/', routesUser) // load user routing

LOG.info('Loaded routing.')

// let estimate controller handle all estimate routing
//app.get("/estimate", function(req, res){
//    res.render("estimate/index")
//});

//app.get("/estimate/create", function(req, res){
//    res.render("estimate/create")
//});

app.use((req, res) => { res.status(404).render('404.ejs') }) // handle page not found errors

// initialize data ............................................
require('./utils/seeder.js')(app) // load seed data

// start Express app
app.listen(app.get('port'), () => {
    console.log('App is running at http://localhost:%d in %s mode', app.get('port'), app.get('env'))
    console.log('  Press CTRL-C to stop\n')
})

module.exports = app