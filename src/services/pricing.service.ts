import { PricingResponse } from '../types/pricing.types.js';
import { getMeeting } from '../storage/meeting.store.js';

export class PricingService {
  /**
   * Calculates dynamic pricing based on meeting duration from the store.
   * 0-5 minutes = ₹20
   * 5-10 minutes = ₹50
   * >10 minutes = ₹100
   */
  public calculatePricing(meetingId: string): PricingResponse {
    const meeting = getMeeting(meetingId);

    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const { durationMinutes } = meeting;
    let price = 0;

    if (durationMinutes <= 5) {
      price = 20;
    } else if (durationMinutes <= 10) {
      price = 50;
    } else {
      price = 100;
    }

    return {
      meetingId,
      durationMinutes,
      price,
      currency: 'INR'
    };
  }
}

export const pricingService = new PricingService();
