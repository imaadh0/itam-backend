declare module "express-serve-static-core" {
  interface Request {
    user?: import("./auth").AuthenticatedUser;
  }
}

export {};
