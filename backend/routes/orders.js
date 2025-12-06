const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// All order routes require authentication
router.use(authMiddleware);

// GET all user's orders
router.get('/', async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.userId },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET single order
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(id),
        userId: req.userId
      },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// CREATE order from cart
router.post('/', async (req, res) => {
  try {
    // Get user's cart
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: req.userId },
      include: { product: true }
    });
    
    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    
    // Calculate total and validate stock
    let total = 0;
    for (const item of cartItems) {
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${item.product.name}`
        });
      }
      total += parseFloat(item.product.price) * item.quantity;
    }
    
    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.order.create({
        data: {
          userId: req.userId,
          total: total,
          status: 'pending'
        }
      });
      
      // Create order items and update product stock
      for (const item of cartItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price
          }
        });
        
        // Decrease product stock
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }
      
      // Clear cart
      await tx.cartItem.deleteMany({
        where: { userId: req.userId }
      });
      
      return newOrder;
    });
    
    // Fetch complete order with items
    const completeOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });
    
    res.status(201).json(completeOrder);
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// UPDATE order status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    // Verify order belongs to user
    const existingOrder = await prisma.order.findFirst({
      where: {
        id: parseInt(id),
        userId: req.userId
      }
    });
    
    if (!existingOrder) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    const order = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        orderItems: {
          include: {
            product: true
          }
        }
      }
    });
    
    res.json(order);
  } catch (error) {
    console.error('Update order error:', error);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// DELETE/CANCEL order (only if pending)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(id),
        userId: req.userId
      },
      include: {
        orderItems: true
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Can only cancel pending orders' });
    }
    
    // Restore stock and delete order in transaction
    await prisma.$transaction(async (tx) => {
      // Restore product stock
      for (const item of order.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity
            }
          }
        });
      }
      
      // Delete order (cascade will delete order items)
      await tx.order.delete({
        where: { id: parseInt(id) }
      });
    });
    
    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;