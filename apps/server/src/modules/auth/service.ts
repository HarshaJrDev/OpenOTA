import { usersRepo } from "../../db/repositories.js";
import { ValidationError } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSessionToken } from "./session.js";

export class InvalidCredentialsError extends ValidationError {
  constructor() {
    super("Invalid email or password");
  }
}

export class EmailAlreadyRegisteredError extends ValidationError {
  constructor() {
    super("An account with this email already exists");
  }
}

export function signup(email: string, password: string): { userId: string; token: string } {
  if (usersRepo.findByEmail(email)) {
    throw new EmailAlreadyRegisteredError();
  }

  const user = usersRepo.create(email, hashPassword(password));
  return { userId: user.id, token: createSessionToken(user.id) };
}

export function login(email: string, password: string): { userId: string; token: string } {
  const user = usersRepo.findByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new InvalidCredentialsError();
  }

  return { userId: user.id, token: createSessionToken(user.id) };
}
