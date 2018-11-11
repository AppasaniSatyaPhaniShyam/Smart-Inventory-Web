const async = require('async')
const crypto = require('crypto')

const passport = require('passport')

const User = require('../models/user')

/**
 * Registering new user
 */
exports.newUser = function (newUser) {
  LOG.debug('Registering ' + newUser.email)
  const user = new User(newUser)

  User.findOne({ email: newUser.email }, (err, existingUser) => {
    if (err) {
      LOG.error(err.message)
      return
    }
    if (existingUser) {
      LOG.debug('User already exists: ', user.email)
      User.remove({ email: existingUser.email }, (err, removed) => {
        if (err) {
          LOG.error(err.message)
        }
      })
      return
    }
    user.save()
    LOG.info(`User with email: ${newUser.email} successfully registered.`)
  })
}

/**
 * GET /login
 * Login page.
 */
exports.getLogin = (req, res) => {
  if (req.user) {
    return res.redirect('/')
  }
  res.render('account/login', {
    title: 'Login'
  })
}

/**
 * POST /login
 * Sign in using email and password.
 */
exports.postLogin = (req, res, next) => {
  req.assert('email', 'Email is not valid').isEmail()
  req.assert('password', 'Password cannot be blank').notEmpty()
  req.sanitize('email').normalizeEmail({ remove_dots: false })
  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/login')
  }

  passport.authenticate('local', (err, user, info) => {
    if (err) { return next(err) }
    if (!user) {
      LOG.info(info)
      req.flash('errors', info)
      return res.redirect('/login')
    }
    req.logIn(user, (err) => {
      if (err) { return next(err) }
      req.flash('success', 'Success! You are logged in.')
      LOG.error(err)
      res.redirect(req.session.returnTo || '/')
    })
  })(req, res, next)
}




/**
 * GET /logout
 * Log out.
 */
exports.logout = (req, res) => {
  req.logout()
  req.flash('success', 'Successfully logged out.')
  res.redirect('/login')
}




/**
 * GET /signup
 * Signup page.
 */
exports.getSignup = (req, res) => {
  if (req.user) {
    return res.redirect('/')
  }
  res.render('account/signup', {
    title: 'Create Account'
  })
}






/**
 * POST /signup
 * Create a new local account.
 */
exports.postSignup = (req, res, next) => {
  req.assert('email', 'Email is not valid').isEmail()
  req.assert('password', 'Password must be at least 4 characters long').len(4)
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password)
  req.sanitize('email').normalizeEmail({ remove_dots: false })

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/signup')
  }

  const user = new User({
    email: req.body.email,
    password: req.body.password
  })

  User.findOne({ email: req.body.email }, (err, existingUser) => {
    if (err) { return next(err) }
    if (existingUser) {
      req.flash('errors', { msg: 'Account with that email address already exists.' })
      LOG.info('User already exists.')
      return res.redirect('/signup')
    }
    user.save((err) => {
      if (err) { return next(err) }
      req.logIn(user, (err) => {
        if (err) {
          return next(err)
        }
        res.redirect('/')
      })
    })
  })
}



/**
 * GET /account
 * Profile page.
 */
exports.getAccount = (req, res) => {
  res.render('account/profile', {
    title: 'Account Management'
  })
}



/**
 * POST /account/profile
 * Update profile information.
 */
exports.postUpdateProfile = (req, res, next) => {
  req.assert('email', 'Please enter a valid email address.').isEmail()
  req.sanitize('email').normalizeEmail({ remove_dots: false })

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/account')
  }

  User.findById(req.user.id, (err, user) => {
    if (err) { return next(err) }
    user.email = req.body.email || ''
    user.profile.name = req.body.name || ''
    user.profile.gender = req.body.gender || ''
    user.profile.location = req.body.location || ''
    user.profile.website = req.body.website || ''
    user.save((err) => {
      if (err) {
        if (err.code === 11000) {
          req.flash('errors', { msg: 'The email address you have entered is already associated with an account.' })
          return res.redirect('/account')
        }
        return next(err)
      }
      req.flash('success', { msg: 'Profile information has been updated.' })
      res.redirect('/account')
    })
  })
}




/**
 * POST /account/password
 * Update current password.
 */
exports.postUpdatePassword = (req, res, next) => {
  req.assert('password', 'Password must be at least 4 characters long').len(4)
  req.assert('confirmPassword', 'Passwords do not match').equals(req.body.password)

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/account')
  }

  User.findById(req.user.id, (err, user) => {
    if (err) { return next(err) }
    user.password = req.body.password
    user.save((err) => {
      if (err) { return next(err) }
      req.flash('success', { msg: 'Password has been changed.' })
      res.redirect('/account')
    })
  })
}



/**
 * POST /account/delete
 * Delete user account.
 */
exports.postDeleteAccount = (req, res, next) => {
  User.remove({ _id: req.user.id }, (err) => {
    if (err) { return next(err) }
    req.logout()
    req.flash('info', { msg: 'Your account has been deleted.' })
    res.redirect('/')
  })
}



/**
 * GET /account/unlink/:provider
 * Unlink OAuth provider.
 */
exports.getOauthUnlink = (req, res, next) => {
  const provider = req.params.provider
  User.findById(req.user.id, (err, user) => {
    if (err) { return next(err) }
    user[provider] = undefined
    user.tokens = user.tokens.filter(token => token.kind !== provider)
    user.save((err) => {
      if (err) { return next(err) }
      req.flash('info', { msg: `${provider} account has been unlinked.` })
      res.redirect('/account')
    })
  })
}





/**
 * GET /reset/:token
 * Reset Password page.
 */
exports.getReset = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  User
    .findOne({ passwordResetToken: req.params.token })
    .where('passwordResetExpires').gt(Date.now())
    .exec((err, user) => {
      if (err) { return next(err) }
      if (!user) {
        req.flash('errors', { msg: 'Password reset token is invalid or has expired.' })
        return res.redirect('/forgot')
      }
      res.render('account/reset', {
        title: 'Password Reset'
      })
    })
}






/**
 * POST /reset/:token
 * Process the reset password request.
 */
exports.postReset = (req, res, next) => {
  req.assert('password', 'Password must be at least 4 characters long.').len(4)
  req.assert('confirm', 'Passwords must match.').equals(req.body.password)

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('back')
  }

  async.waterfall([
    function resetPassword (done) {
      User
        .findOne({ passwordResetToken: req.params.token })
        .where('passwordResetExpires').gt(Date.now())
        .exec((err, user) => {
          if (err) { return next(err) }
          if (!user) {
            req.flash('errors', { msg: 'Password reset token is invalid or has expired.' })
            return res.redirect('back')
          }
          user.password = req.body.password
          user.passwordResetToken = undefined
          user.passwordResetExpires = undefined
          user.save((err) => {
            if (err) { return next(err) }
            req.logIn(user, (err) => {
              done(err, user)
            })
          })
        })
    },
    function sendResetPasswordEmail (user, done) {
      const transporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USER,
          pass: process.env.SENDGRID_PASSWORD
        }
      })
      const mailOptions = {
        to: user.email,
        from: 'smartinventory@sm.com',
        subject: 'Your password has been changed',
        text: `This is a confirmation that the password for your account ${user.email} has just been changed.\n`
      }
      transporter.sendMail(mailOptions, (err) => {
        req.flash('success', { msg: 'Success! Your password has been changed.' })
        done(err)
      })
    }
  ], (err) => {
    if (err) { return next(err) }
    res.redirect('/')
  })
}

/**
 * GET /forgot
 * Forgot Password page.
 */
exports.getForgot = (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  res.render('account/forgot', {
    title: 'Forgot Password'
  })
}

/**
 * POST /forgot
 * Create a random token, then the send user an email with a reset link.
 */
exports.postForgot = (req, res, next) => {
  req.assert('email', 'Please enter a valid email address.').isEmail()
  req.sanitize('email').normalizeEmail({ remove_dots: false })

  const errors = req.validationErrors()

  if (errors) {
    req.flash('errors', errors)
    return res.redirect('/forgot')
  }

}