import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import { getRegionConfig } from "./regions";
import { isGrpcEnabled, GrpcDisabledError } from "./grpc-enabled";
import type {
  PushToRabbitMQQueueRequest,
  BroadcastToRabbitMQExchangeRequest,
  PushToRabbitMQResponse,
  CheckSyncRequest,
  CheckSyncResponse,
  GetNumbersNotInBifrostRequest,
  GetNumbersNotInBifrostResponse,
  GetNumbersNotInNumberCacheRequest,
  GetNumbersNotInNumberCacheResponse,
  GenerateSignedURLRequest,
  GenerateSignedURLResponse,
  ListPracticesRequest,
  ListPracticesResponse,
  GetCallDetailsRequest,
  GetCallDetailsResponse,
  GetCompleteCallDetailsRequest,
  GetCompleteCallDetailsResponse,
} from "@/types/grpc";
import { generateJWTToken } from "./jwt";

const PROTO_PATH = path.join(process.cwd(), "proto", "ops.proto");

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false, // Convert snake_case to camelCase for TypeScript
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

interface OperationsServiceClient extends grpc.Client {
  PushToRabbitMQQueue: (
    request: PushToRabbitMQQueueRequest,
    callback: (error: grpc.ServiceError | null, response: PushToRabbitMQResponse) => void
  ) => void;
  BroadcastToRabbitMQExchange: (
    request: BroadcastToRabbitMQExchangeRequest,
    callback: (error: grpc.ServiceError | null, response: PushToRabbitMQResponse) => void
  ) => void;
  CheckSync: (
    request: CheckSyncRequest,
    callback: (error: grpc.ServiceError | null, response: CheckSyncResponse) => void
  ) => void;
  GetNumbersNotInBifrost: (
    request: GetNumbersNotInBifrostRequest,
    callback: (error: grpc.ServiceError | null, response: GetNumbersNotInBifrostResponse) => void
  ) => void;
  GetNumbersNotInNumberCache: (
    request: GetNumbersNotInNumberCacheRequest,
    callback: (error: grpc.ServiceError | null, response: GetNumbersNotInNumberCacheResponse) => void
  ) => void;
  GenerateSignedURL: (
    request: GenerateSignedURLRequest,
    callback: (error: grpc.ServiceError | null, response: GenerateSignedURLResponse) => void
  ) => void;
  ListPractices: (
    request: ListPracticesRequest,
    callback: (error: grpc.ServiceError | null, response: ListPracticesResponse) => void
  ) => void;
  GetCallDetails: (
    request: GetCallDetailsRequest,
    callback: (error: grpc.ServiceError | null, response: GetCallDetailsResponse) => void
  ) => void;
  GetCompleteCallDetails: (
    request: GetCompleteCallDetailsRequest,
    callback: (error: grpc.ServiceError | null, response: GetCompleteCallDetailsResponse) => void
  ) => void;
}

function createMetadata(
  regionCode: string,
  userId?: string,
  clientIP?: string,
  requestId?: string
): grpc.Metadata {
  const metadata = new grpc.Metadata();
  metadata.set("x-region", regionCode);
  // Add client IP if provided
  if (clientIP) {
    metadata.set("x-client-ip", clientIP);
  }

  // Add request ID if provided
  if (requestId) {
    metadata.set("x-correlation-id", requestId);
  }
  // implement jwt token instead of AUTH_TOKEN environment variable
  const jwtToken = generateJWTToken(regionCode, { sub: userId, requestId }, "300");  
  if (jwtToken) {
    metadata.set("authorization", `Bearer ${jwtToken}`);
  } else {
    console.warn(`Warning: JWT token for region ${regionCode} is not set`);
  }
  
  return metadata;
}

export { GrpcDisabledError };

export function getGrpcClient(
  regionCode: string,
  userId?: string,
  clientIP?: string,
  requestId?: string
): OperationsServiceClient {
  if (!isGrpcEnabled()) {
    throw new GrpcDisabledError();
  }
  const regionConfig = getRegionConfig(regionCode);
  
  if (!regionConfig) {
    throw new Error(`Invalid region code: ${regionCode}`);
  }

  const opsProto = grpc.loadPackageDefinition(packageDefinition) as any;
  const ServiceClient = opsProto.ops.OperationsService as grpc.ServiceClientConstructor;
  
  const client = new ServiceClient(
    `${regionConfig.grpcHost}:${regionConfig.grpcPort}`,
    grpc.credentials.createInsecure()
  ) as unknown as OperationsServiceClient;

  // Store region code, userId, clientIP and metadata creator on the client for use in grpcCall
  (client as any).__regionCode = regionCode;
  (client as any).__userId = userId;
  (client as any).__clientIP = clientIP;
  (client as any).__requestId = requestId;
  (client as any).__createMetadata = () => createMetadata(regionCode, userId, clientIP, requestId);

  return client;
}

export function grpcCall<TRequest, TResponse>(
  client: OperationsServiceClient,
  method: keyof OperationsServiceClient,
  request: TRequest
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    // Get metadata with x-region and authorization headers
    const metadata = (client as any).__createMetadata
      ? (client as any).__createMetadata()
      : new grpc.Metadata();

    const methodCall = client[method] as any;
    const methodName = method as string;
    
    // Get method definition from the service
    const service = (client.constructor as any).service;
    const methodDefinition = service[methodName];
    
    if (!methodDefinition) {
      reject(new Error(`Method ${methodName} not found in service`));
      return;
    }

    client.makeUnaryRequest(
      methodDefinition.path,
      methodDefinition.requestSerialize,
      methodDefinition.responseDeserialize,
      request,
      metadata,
      {}, // options
      (error: grpc.ServiceError | null, response?: TResponse) => {
        if (error) {
          reject(error);
          return;
        }
        if (response === undefined) {
          reject(new Error("No response received from gRPC call"));
          return;
        }
        resolve(response);
      }
    );
  });
}
