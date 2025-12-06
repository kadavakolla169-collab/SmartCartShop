const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET all products (public)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    
    const where = {};
    if (category) {
      where.category = category;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET single product (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// CREATE product (admin only)
router.post('/', adminMiddleware, async (req, res) => {
  try {
    const { name, description, price, imageUrl, stock, category } = req.body;
    
    // Validate input
    if (!name || !description || !price || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        imageUrl: imageUrl || null,
        stock: stock || 0,
        category
      }
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// UPDATE product (admin only)
router.put('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, imageUrl, stock, category } = req.body;
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (stock !== undefined) updateData.stock = stock;
    if (category !== undefined) updateData.category = category;
    
    const product = await prisma.product.update({
      where: { id: parseInt(id) },
      data: updateData
    });
    
    res.json(product);
  } catch (error) {
    console.error('Update product error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE product (admin only)
router.delete('/:id', adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.product.delete({
      where: { id: parseInt(id) }
    });
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;