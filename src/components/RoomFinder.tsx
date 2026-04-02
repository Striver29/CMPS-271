import { useState } from 'react';
import { Box, Button, MenuItem, Select, TextField, Typography } from '@mui/material';
import type { Course, Day } from '../types';
import { getAvailableRoomsAtTime } from '../utils/classroomUtils';

type Props = {
  courses: Course[];
};

const days: Day[] = ['M', 'T', 'W', 'R', 'F'];

export default function RoomFinder({ courses }: Props) {
  const [day, setDay] = useState<Day>('M');
  const [time, setTime] = useState('12:00');
  const [rooms, setRooms] = useState<{ room: string; building: string }[]>([]);

  const handleSearch = () => {
    const result = getAvailableRoomsAtTime(courses, day, time);
    setRooms(result);
  };

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Room Finder
      </Typography>

      <Box display="flex" gap={2} mb={2}>
        <Select value={day} onChange={(e) => setDay(e.target.value as Day)}>
          {days.map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </Select>

        <TextField
          label="Time (HH:MM)"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />

        <Button variant="contained" onClick={handleSearch}>
          Find Rooms
        </Button>
      </Box>

      <Box>
        {rooms.map((r) => (
          <Typography key={r.room}>
            {r.room}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}