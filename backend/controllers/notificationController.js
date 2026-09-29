const prisma = require('../config/prisma');
const { toApiRecord, toApiRecords } = require('../utils/apiRecord');

// GET /api/notifications
const getNotifications = async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { farmerId: req.farmer.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(toApiRecords(notifications));
  } catch (err) {
    next(err);
  }
};

// PUT /api/notifications/:id/read
const markRead = async (req, res, next) => {
  try {
    const owned = await prisma.notification.findFirst({
      where: { id: req.params.id, farmerId: req.farmer.id },
    });
    const notification = owned
      ? await prisma.notification.update({ where: { id: owned.id }, data: { read: true } })
      : null;
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(toApiRecord(notification));
  } catch (err) {
    next(err);
  }
};

// PUT /api/notifications/read-all
const markAllRead = async (req, res, next) => {
  try {
    await prisma.notification.updateMany({ where: { farmerId: req.farmer.id, read: false }, data: { read: true } });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications, markRead, markAllRead };
