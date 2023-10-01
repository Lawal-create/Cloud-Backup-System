const APP_TYPES = {
  EmailClient: Symbol.for("EmailClient"),
  UserRepository: Symbol.for("UserRepository"),
  UserService: Symbol.for("UserService"),
  EmailService: Symbol.for("EmailService"),
  AuthMiddleware: Symbol.for("AuthMiddleware"),
};

export default APP_TYPES;
