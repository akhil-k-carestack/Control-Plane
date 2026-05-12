// RabbitMQ Types
export interface PushToRabbitMQQueueRequest {
  queueName: string;
  payloadJson: string;
}

export interface BroadcastToRabbitMQExchangeRequest {
  exchangeName: string;
  payloadJson: string;
}

export interface PushToRabbitMQResponse {
  success: boolean;
  message: string;
  queueOrExchange?: string;
}

// Check Sync Types
export interface CheckSyncRequest {
  checkType: {
    device?: CheckSyncDevice;
    location?: CheckSyncLocation;
    practice?: CheckSyncPractice;
    allBifrost?: CheckSyncAllBifrost;
  };
}

export interface CheckSyncDevice {
  deviceMake: string; // "Yealink" or "Polycom"
  sipAccount: string;
}

export interface CheckSyncLocation {
  locationId: string;
}

export interface CheckSyncPractice {
  practiceId: string;
}

export interface CheckSyncAllBifrost {
  confirm: boolean;
}

export interface CheckSyncResponse {
  success: boolean;
  message: string;
  results: SyncResult[];
}

export interface SyncResult {
  identifier: string; // Device SIP, Location ID, or Practice ID
  inSync: boolean;
  details: string;
}

// Numbers Not In Bifrost Types
export interface GetNumbersNotInBifrostRequest {
  trunkSid: string;
}

export interface GetNumbersNotInBifrostResponse {
  success: boolean;
  message: string;
  practiceNumbers: Record<string, PhoneNumberList>;
}

export interface PhoneNumberList {
  phoneNumbers: string[];
}

// Numbers Not In Number Cache Types
export interface GetNumbersNotInNumberCacheRequest {
  // No parameters needed - checks all Bifrost practices
}

export interface GetNumbersNotInNumberCacheResponse {
  success: boolean;
  message: string;
  practiceNumbers: Record<string, PhoneNumberList>;
}

// Generate Signed URL Types
export interface GenerateSignedURLRequest {
  url: string;
}

export interface GenerateSignedURLResponse {
  success: boolean;
  message: string;
  signedUrl: string;
  expiresIn: number; // Expiry time in seconds
}

// List Practices Types
export interface ListPracticesRequest {
  // No parameters needed - returns all active practices
}

export interface Practice {
  practiceId: string;
  practiceName: string;
}

export interface ListPracticesResponse {
  success: boolean;
  message: string;
  practices: Practice[];
}

// Get Call Details Types
export interface GetCallDetailsRequest {
  practiceId: string; // Required: Practice ID
  callId: string; // Required: Call ID to search for
}

export interface CallFlowEvent {
  action: string; // e.g., "INCOMING_CALL", "IVR", "QUEUE", "ANSWERED", etc.
  timestamp: string; // ISO 8601
  arguments: Record<string, string>; // Event-specific data
  isCampaign?: boolean; // For incoming calls
}

export interface CallFlow {
  callId: string;
  phoneNumber: string;
  events: CallFlowEvent[];
}

export interface CallDetails {
  grafanaUrl: string;
  callId: string;
  practiceId: string;
  callTime: string; // ISO 8601 timestamp
  conversationDuration: number; // Duration in seconds
  callerNumber: string;
  calleeNumber: string;
  callDirection: string; // "inbound" or "outbound"
  voicemail: boolean;
  recordingUrl: string;
  callEndTime: string; // ISO 8601 timestamp
  callFlow?: CallFlow;
}

export interface GetCallDetailsResponse {
  success: boolean;
  message: string;
  callDetails?: CallDetails;
}

// Get Complete Call Details Types
export interface GetCompleteCallDetailsRequest {
  callId: string; // Required: Call ID to search for
  practiceId?: string; // Optional: Practice ID for filtering
}

export interface CompleteCallDetails {
  callId: string;
  practiceId: string;
  callHistoryJson: string; // Complete callhistory document as JSON string
  callLifecycleJson: string; // Complete calllifecycles document as JSON string
  hasCallHistory: boolean; // Whether callhistory document exists
  hasCallLifecycle: boolean; // Whether calllifecycles document exists
}

export interface GetCompleteCallDetailsResponse {
  success: boolean;
  message: string;
  callDetails?: CompleteCallDetails;
}

// Legacy types for backward compatibility (deprecated - use new types above)
export interface PushQueueRequest {
  queueName: string;
  payload: string;
}

export interface PushQueueResponse {
  success: boolean;
  message: string;
}

export interface GetNumbersRequest {
  trunkSid: string;
}

export interface NumberInfo {
  number: string;
  trunkSid: string;
  status: string;
  createdAt: number;
}

export interface GetNumbersResponse {
  numbers: NumberInfo[];
}
