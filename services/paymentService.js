import { API_BASE_URL } from '../config';

// Helper to get authorization headers
const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

const paymentService = {
  /**
   * Initialize payment for a PDF.
   * This endpoint creates a payment session on the backend.
   * @param {number|string} pdfId - The ID of the PDF for which payment is initialized.
   * @returns {Promise<Object>} - The JSON response from the server.
   */
  async initializePayment(pdfId) {
    try {
      const response = await fetch(`${API_BASE_URL}/payment/initialize/${pdfId}`, {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Payment initialization failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error initializing payment:', error.message);
      throw error;
    }
  },

  /**
   * Verify a payment after completion.
   * @param {string} reference - The payment reference returned by the payment gateway.
   * @returns {Promise<Object>} - The JSON response from the server.
   */
  async verifyPayment(reference) {
    try {
      const response = await fetch(`${API_BASE_URL}/payment/verify`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reference }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Payment verification failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error verifying payment:', error.message);
      throw error;
    }
  },

  /**
   * Get all purchases made by the current user.
   * @returns {Promise<Object>} - The JSON response containing the list of purchases.
   */
  async getUserPurchases() {
    try {
      const response = await fetch(`${API_BASE_URL}/payment/purchases`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch purchases with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching purchases:', error.message);
      throw error;
    }
  },

  /**
   * Check if the user has already purchased a given PDF.
   * @param {number|string} pdfId - The ID of the PDF.
   * @returns {Promise<boolean>} - True if the PDF has already been purchased, false otherwise.
   */
  async checkPurchaseStatus(pdfId) {
    try {
      const response = await fetch(`${API_BASE_URL}/payment/check-purchase/${pdfId}`, {
        method: 'GET',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to check purchase status with status ${response.status}`);
      }

      const data = await response.json();
      return data.hasPurchased;
    } catch (error) {
      console.error('Error checking purchase status:', error.message);
      throw error;
    }
  }
};

export default paymentService;
