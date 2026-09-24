// Tipe yang dipakai bersama oleh server dan browser (tanpa import server).

export type AttendeeStatus = "needsAction" | "accepted" | "declined" | "tentative";

export type Attendee = {
  email: string;
  name?: string;
  status: AttendeeStatus;
  self?: boolean;
  organizer?: boolean;
};

export type PlannerEvent = {
  id: string;
  calendarId: string;
  calendar: string;
  calendarColor?: string;
  title: string;
  start: string; // RFC3339 atau YYYY-MM-DD (seharian)
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  link?: string;
  organizer?: string;
  isOrganizer: boolean;
  attendees: Attendee[];
  myResponse?: AttendeeStatus;
  canEdit: boolean;
};

export type NewEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:MM
  endTime?: string; // HH:MM
  allDay?: boolean;
  description?: string;
  location?: string;
  attendees?: string[];
};

export type EventChanges = {
  title?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  allDay?: boolean;
  location?: string;
  description?: string;
  addAttendees?: string[];
  removeAttendees?: string[];
};

export type RsvpResponse = "accepted" | "declined" | "tentative";

export type Proposal =
  | { type: "create"; event: NewEvent }
  | { type: "update"; calendarId: string; eventId: string; title: string; when: string; changes: EventChanges }
  | {
      type: "delete";
      calendarId: string;
      eventId: string;
      title: string;
      when: string;
      isOrganizer: boolean;
      attendeeCount: number;
    }
  | { type: "rsvp"; eventId: string; title: string; when: string; response: RsvpResponse };
