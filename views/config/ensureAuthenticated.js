module.exports = {
  ensureLoggedIn (req, res, next) {
    if (req.isAuthenticated()) {
      return next()
    }
    req.flash('failure', 'Please login before creating an estimate.')
    res.render('account/login', { status: 'Please login.', errors: '' })
  }
}
