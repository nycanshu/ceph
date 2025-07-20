const express = require('express');
const {
  signup,
  login,
  //  getSignupValidationRules,
  // getLoginValidationRules
} = require('../controllers/userController');

const router = express.Router();

// User routes
router.post('/signup', signup);
router.post('/login', login);

module.exports = router; 