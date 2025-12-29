export interface Settings {
  skipKey: string;
  holdToSend: boolean;
  autoExpandChats: boolean;
  autoTempChat: boolean;
  tempChatEnabled: boolean;
}

export const SETTINGS_DEFAULTS: Settings = {
  skipKey: "Shift",
  holdToSend: false,
  autoExpandChats: true,
  autoTempChat: false,
  tempChatEnabled: false
};
