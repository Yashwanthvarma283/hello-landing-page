/** Default AI is reserved for the home-page main IDE chatbot. */
export function usePrimaryForChat(pagePath: unknown, purpose: unknown, ideUsePrimary: boolean): boolean {
  return pagePath !== '/' || purpose !== 'main-ide-chatbot' || ideUsePrimary;
}

/** The admin's model always wins, even when a caller supplies an override. */
export function primaryModel(model: string, label: string): string {
  if (model.trim()) return model;
  throw new Error(`No model configured for primary key "${label}". Set a default model in the Admin Dashboard → AI API Keys.`);
}