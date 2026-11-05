import { Slot } from 'expo-router';
import { FootballProvider } from '../../App';

export default function RootLayout() {
  return <FootballProvider><Slot /></FootballProvider>;
}
