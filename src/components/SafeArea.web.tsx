import { View, type ViewProps } from 'react-native';
import '../safe-area.css';

export function SafeAreaView({ children, style }: ViewProps) {
  return <View style={style}><main className="app-safe-area">{children}</main></View>;
}
