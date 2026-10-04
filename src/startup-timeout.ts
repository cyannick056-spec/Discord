export function withDeadline<T>(work:Promise<T>,milliseconds:number,message:string):Promise<T>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(message)),milliseconds);
  work.then(value=>{clearTimeout(timer);resolve(value)},error=>{clearTimeout(timer);reject(error)});
 });
}
export async function activityFetch(input:RequestInfo|URL,init:RequestInit={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{return await fetch(input,{...init,signal:controller.signal})}
 catch(error){if(controller.signal.aborted)throw new Error('La conexión está tardando. Vuelve a intentar.');throw error}
 finally{clearTimeout(timer)}
}
