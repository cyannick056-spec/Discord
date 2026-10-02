export const defaultLightResponse = 35;
export function lightResponse(value=defaultLightResponse) {return Math.max(0,Math.min(100,value))/100;}
export function objectLightGain(photoGain:number,response=defaultLightResponse) {return 1+(photoGain-1)*lightResponse(response);}
