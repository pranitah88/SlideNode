export interface Meeting {
  id: string;
  meeting_name: string;
  file_name: string;
  audio_duration_seconds: number;
  billable_minutes: number;
  price_usdc: number;
  status: 'uploaded' | 'payment_pending' | 'payment_verified' | 'processing' | 'completed' | 'failed';
  transcript: string | null;
}

export interface Payment {
  transaction_id: string;
  amount_usdc: number;
  currency: string;
  network: string;
  payment_protocol: string;
  status: string;
}

export interface Slide {
  slide_number: number;
  title: string;
  content: string;
}

export interface Speaker {
  speaker_name: string;
  total_duration_seconds: number;
}

export interface ActionItem {
  person: string;
  task: string;
  deadline: string;
  priority: string;
  status: string;
}

export interface MeetingResponse {
  success: boolean;
  meeting: Meeting;
  payment: Payment | null;
  slides: Slide[];
  speakers: Speaker[];
  action_items: ActionItem[];
  error?: string;
}

export interface ProcessResponse {
  success: boolean;
  meeting_id: string;
  status: string;
  payment?: Payment;
  processing?: {
    transcript: boolean;
    slides: boolean;
    speakers: boolean;
    action_items: boolean;
  };
  error?: string;
}
