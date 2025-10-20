export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER'
}

export enum LoanStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  REJECTED = 'REJECTED',
  DEFAULTED = 'DEFAULTED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentType {
  LOAN_DISBURSEMENT = 'LOAN_DISBURSEMENT',
  EMI_PAYMENT = 'EMI_PAYMENT',
  PARTIAL_PAYMENT = 'PARTIAL_PAYMENT',
  INTEREST_PAYMENT = 'INTEREST_PAYMENT',
  PENALTY_PAYMENT = 'PENALTY_PAYMENT',
  LOAN_CLOSURE = 'LOAN_CLOSURE'
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface CreateCustomerRequest {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  dateOfBirth: string;
  occupation: string;
  monthlyIncome: number;
  aadharNumber: string;
  panNumber: string;
}

export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {
  id: string;
}

export interface CreateLoanRequest {
  customerId: string;
  principalAmount: number;
  interestRate: number;
  tenure: number;
  goldItems?: {
    itemType: string;
    weight: number;
    purity: string;
    description?: string;
    currentRate: number;
  }[];
  purpose?: string;
  remarks?: string;
}

export interface CreatePaymentRequest {
  loanId: string;
  amount: number;
  paymentType: PaymentType;
  paymentMethod: string;
  transactionId?: string;
  dueDate?: string;
  principalAmount?: number;
  interestAmount?: number;
  penaltyAmount?: number;
  notes?: string;
}

export interface FileUploadResponse {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
}