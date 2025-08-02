export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, secret, userAddress } = req.body;

    // Mock relayer response
    const result = {
      success: true,
      message: 'Secret provided successfully',
      orderId,
      secretHash: `0x${Buffer.from(secret).toString('hex')}`,
      timestamp: new Date().toISOString()
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to provide secret' });
  }
} 