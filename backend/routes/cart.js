const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// All cart routes require authentication
router.use(authMiddleware);

// GET user's cart
router.get('/', async (req, res) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: {
        product: true
      }
    });
    
    res.json(cartItems);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// ADD item to cart (CREATE)
router.post('/', async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    if (!productId || !quantity || quantity < 1) {
      return res.status(400).json({ error: 'Invalid product or quantity' });
    }
    
    // Check if product exists and has enough stock
    const product = await prisma.product.findUnique({
      where: { id: parseInt(productId) }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    if (product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    // Check if item already in cart
    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: req.userId,
          productId: parseInt(productId)
        }
      }
    });
    
    let cartItem;
    
    if (existingCartItem) {
      // Update quantity
      cartItem = await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: existingCartItem.quantity + quantity
        },
        include: { product: true }
      });
    } else {
      // Create new cart item
      cartItem = await prisma.cartItem.create({
        data: {
          userId: req.userId,
          productId: parseInt(productId),
          quantity
        },
        include: { product: true }
      });
    }
    
    res.status(201).json(cartItem);
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// UPDATE cart item quantity
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
    
    // Check if cart item belongs to user
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: parseInt(id),
        userId: req.userId
      },
      include: { product: true }
    });
    
    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    // Check stock
    if (cartItem.product.stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }
    
    const updatedCartItem = await prisma.cartItem.update({
      where: { id: parseInt(id) },
      data: { quantity },
      include: { product: true }
    });
    
    res.json(updatedCartItem);
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ error: 'Failed to update cart item' });
  }
});

// DELETE cart item
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: parseInt(id),
        userId: req.userId
      }
    });
    
    if (!cartItem) {
      return res.status(404).json({ error: 'Cart item not found' });
    }
    
    await prisma.cartItem.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Delete cart item error:', error);
    res.status(500).json({ error: 'Failed to remove item from cart' });
  }
});

// CLEAR entire cart
router.delete('/', async (req, res) => {
  try {
    await prisma.cartItem.deleteMany({
      where: { userId: req.userId }
    });
    
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;