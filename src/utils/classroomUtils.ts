import type { Course, Day } from '../types';

export type RoomAvailability = {
  room: string;
  building: string;
};

function isUsableLocation(location?: string): location is string {
  if (!location) return false;

  const value = location.trim().toUpperCase();

  if (!value) return false;
  if (value === 'TBA') return false;
  if (value === 'ONLINE') return false;
  if (value === 'N/A') return false;

  return true;
}

function normalizeRoom(location: string): string {
  return location.trim().replace(/\s+/g, ' ');
}

function getBuildingFromRoom(room: string): string {
  return room.split(' ')[0] || room;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function isMeetingOccurringAtTime(start: string, end: string, selectedTime: string): boolean {
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);
  const selectedMin = timeToMinutes(selectedTime);

  return selectedMin >= startMin && selectedMin < endMin;
}

export function getAvailableRoomsAtTime(
  courses: Course[],
  day: Day,
  selectedTime: string,
  building?: string
): RoomAvailability[] {
  const allRooms = new Map<string, RoomAvailability>();
  const occupiedRooms = new Set<string>();

  for (const course of courses) {
    for (const meeting of course.meetings) {
      if (!isUsableLocation(meeting.location)) continue;

      const room = normalizeRoom(meeting.location);
      const roomBuilding = getBuildingFromRoom(room);

      if (building && roomBuilding !== building) continue;

      allRooms.set(room, { room, building: roomBuilding });

      if (!meeting.days.includes(day)) continue;

      if (isMeetingOccurringAtTime(meeting.start, meeting.end, selectedTime)) {
        occupiedRooms.add(room);
      }
    }
  }

  return Array.from(allRooms.values())
    .filter(({ room }) => !occupiedRooms.has(room))
    .sort((a, b) => a.room.localeCompare(b.room));
}// classroom utils 
