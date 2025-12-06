const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    
    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user (default role is 'user', only allow 'admin' if explicitly set)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role === 'admin' ? 'admin' : 'user'
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

module.exports = router;