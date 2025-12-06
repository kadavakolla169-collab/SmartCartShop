const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET user's sustainability dashboard
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        greenPoints: true,
        totalCO2Saved: true,
        totalPlasticSaved: true
      }
    });
    
    // Get user's eco-friendly purchases count
    const ecoOrders = await prisma.order.findMany({
      where: { userId: req.userId },
      include: {
        orderItems: {
          include: {
            product: {
              select: { isEcoFriendly: true }
            }
          }
        }
      }
    });
    
    const ecoProductCount = ecoOrders.reduce((count, order) => {
      return count + order.orderItems.filter(item => item.product.isEcoFriendly).length;
    }, 0);
    
    // Calculate ranking
    const allUsers = await prisma.user.findMany({
      orderBy: { greenPoints: 'desc' },
      select: { id: true }
    });
    
    const userRank = allUsers.findIndex(u => u.id === req.userId) + 1;
    
    res.json({
      ...user,
      ecoProductsPurchased: ecoProductCount,
      globalRank: userRank,
      totalUsers: allUsers.length
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// GET user preferences
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    let preferences = await prisma.userPreference.findUnique({
      where: { userId: req.userId }
    });
    
    if (!preferences) {
      preferences = await prisma.userPreference.create({
        data: { userId: req.userId }
      });
    }
    
    res.json(preferences);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// UPDATE user preferences
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const { packagingPreference, notifyGreenDeals, showCarbonFootprint } = req.body;
    
    const preferences = await prisma.userPreference.upsert({
      where: { userId: req.userId },
      update: {
        packagingPreference,
        notifyGreenDeals,
        showCarbonFootprint
      },
      create: {
        userId: req.userId,
        packagingPreference,
        notifyGreenDeals,
        showCarbonFootprint
      }
    });
    
    res.json(preferences);
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// GET leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const topUsers = await prisma.user.findMany({
      orderBy: { greenPoints: 'desc' },
      take: 10,
      select: {
        name: true,
        greenPoints: true,
        totalCO2Saved: true,
        totalPlasticSaved: true
      }
    });
    
    res.json(topUsers);
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Calculate cart's environmental impact
router.get('/cart-impact', authMiddleware, async (req, res) => {
  try {
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: { product: true }
    });
    
    let totalCO2 = 0;
    let totalPlastic = 0;
    let ecoFriendlyCount = 0;
    
    cartItems.forEach(item => {
      totalCO2 += item.product.carbonFootprint * item.quantity;
      totalPlastic += item.product.plasticContent * item.quantity;
      if (item.product.isEcoFriendly) ecoFriendlyCount++;
    });
    
    // Calculate potential green points
    const potentialGreenPoints = Math.floor(ecoFriendlyCount * 10);
    
    res.json({
      totalCO2: totalCO2.toFixed(2),
      totalPlastic: totalPlastic.toFixed(2),
      ecoFriendlyItems: ecoFriendlyCount,
      totalItems: cartItems.length,
      potentialGreenPoints,
      ecoPercentage: cartItems.length > 0 ? ((ecoFriendlyCount / cartItems.length) * 100).toFixed(1) : 0
    });
  } catch (error) {
    console.error('Cart impact error:', error);
    res.status(500).json({ error: 'Failed to calculate impact' });
  }
});

module.exports = router;