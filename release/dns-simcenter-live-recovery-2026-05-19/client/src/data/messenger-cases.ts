import type { ChatInfo, MessengerCase, MessengerOption } from "@shared/simulation-content";
import { createRuntimeArrayProxy, getSimulationContentSnapshot } from "@/lib/runtime-content";

export type { ChatInfo, MessengerCase, MessengerOption };

export const CHATS: ChatInfo[] = createRuntimeArrayProxy(() => getSimulationContentSnapshot().messengerChats);
export const MESSENGER_CASES: MessengerCase[] = createRuntimeArrayProxy(() => getSimulationContentSnapshot().messengerCases);

