export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { 
    fromTokenAddress,
    toTokenAddress, 
    amount,
    fromAddress,
    slippage = 1,
    chainId = 1 
  } = req.body;

  if (!fromTokenAddress || !toTokenAddress || !amount || !fromAddress) {
    return res.status(400).json({ 
      error: 'fromTokenAddress, toTokenAddress, amount, and fromAddress are required' 
    });
  }

  try {
    // Build the swap transaction using 1inch API
    const swapUrl = `https://api.1inch.io/v5.0/${chainId}/swap` +
      `?fromTokenAddress=${fromTokenAddress}` +
      `&toTokenAddress=${toTokenAddress}` +
      `&amount=${amount}` +
      `&fromAddress=${fromAddress}` +
      `&slippage=${slippage}` +
      `&disableEstimate=false`;

    const response = await fetch(swapUrl);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`1inch API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const swapData = await response.json();

    // Return the transaction data that can be signed by the frontend
    res.status(200).json({
      success: true,
      transaction: {
        to: swapData.tx.to,
        data: swapData.tx.data,
        value: swapData.tx.value,
        gasPrice: swapData.tx.gasPrice,
        gas: swapData.tx.gas
      },
      toTokenAmount: swapData.toTokenAmount,
      fromTokenAmount: swapData.fromTokenAmount,
      protocols: swapData.protocols,
      estimatedGas: swapData.tx.gas
    });

  } catch (error) {
    console.error('1inch swap error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to build swap transaction'
    });
  }
}