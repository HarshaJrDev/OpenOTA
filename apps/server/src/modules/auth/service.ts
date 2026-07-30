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

export async function signup(email: string, password: string): Promise<{ userId: string; token: string }> {
  if (await usersRepo.findByEmail(email)) {
    throw new EmailAlreadyRegisteredError();
  }

  const user = await usersRepo.create(email, hashPassword(password));
  return { userId: user.id, token: createSessionToken(user.id) };
}

export async function login(email: string, password: string): Promise<{ userId: string; token: string }> {
  const user = await usersRepo.findByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new InvalidCredentialsError();
  }

  return { userId: user.id, token: createSessionToken(user.id) };
}
