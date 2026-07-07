import { apiRequest } from "@/lib/queryClient";

/** «Связаться с пользователем» — оценщик пишет участнику на его корпоративную почту. */
export async function contactParticipantMail(input: {
  to: string;
  participantName: string;
  subject: string;
  message: string;
}): Promise<void> {
  await apiRequest("POST", "/api/staff/mail/contact-participant", input);
}

/** «Отправить обратную связь на почту» — итоги/отчёт участнику, PDF формируется на сервере. */
export async function sendResultsMail(input: {
  to: string;
  participantName: string;
  summary: string;
  pdfPayload: unknown;
}): Promise<void> {
  await apiRequest("POST", "/api/staff/mail/send-results", input);
}

/** «Назначить обучение на определённую дату». */
export async function scheduleTrainingMail(input: {
  to: string;
  participantName: string;
  trainingDate: string;
  note?: string;
}): Promise<void> {
  await apiRequest("POST", "/api/staff/mail/schedule-training", input);
}
