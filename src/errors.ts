export class DvxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DvxError'
  }
}

export class AuthError extends DvxError {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class AuthProfileNotFoundError extends AuthError {
  constructor(profileName: string) {
    super(`Auth profile '${profileName}' not found`)
    this.name = 'AuthProfileNotFoundError'
  }
}

export class AuthProfileExistsError extends AuthError {
  constructor(profileName: string) {
    super(`Auth profile '${profileName}' already exists`)
    this.name = 'AuthProfileExistsError'
  }
}

export class TokenAcquisitionError extends AuthError {
  constructor(message: string) {
    super(`Failed to acquire token: ${message}`)
    this.name = 'TokenAcquisitionError'
  }
}

export class DataverseError extends DvxError {
  public readonly statusCode: number
  public readonly errorCode?: string
  public readonly retryAfterSeconds?: number

  constructor(message: string, statusCode: number, errorCode?: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'DataverseError'
    this.statusCode = statusCode
    this.errorCode = errorCode
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class EntityNotFoundError extends DataverseError {
  constructor(entity: string) {
    super(`Entity '${entity}' not found`, 404)
    this.name = 'EntityNotFoundError'
  }
}

export class RecordNotFoundError extends DataverseError {
  constructor(entity: string, id: string) {
    super(`Record '${id}' not found in '${entity}'`, 404)
    this.name = 'RecordNotFoundError'
  }
}

export class ValidationError extends DvxError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class SchemaError extends DvxError {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaError'
  }
}

export class FetchXmlValidationError extends DvxError {
  constructor(message: string) {
    super(message)
    this.name = 'FetchXmlValidationError'
  }
}

export class BatchError extends DvxError {
  public readonly operationErrors: Array<{ index: number; message: string }>

  constructor(message: string, operationErrors: Array<{ index: number; message: string }> = []) {
    super(message)
    this.name = 'BatchError'
    this.operationErrors = operationErrors
  }
}
