import * as Device from 'expo-device';

/** False on a simulator or emulator, where there's no camera (see realDevice.web.ts). */
export const isDevice = Device.isDevice;
