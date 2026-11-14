export const MAX_INVITATIONS=25;
export const validEmail=value=>typeof value==='string'&&value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export function invitationEmails(values){
 if(!Array.isArray(values)||!values.length||values.length>MAX_INVITATIONS)throw Error('Add between 1 and 25 invitation email addresses.');
 const emails=values.map(value=>typeof value==='string'?value.trim().toLowerCase():'');
 if(emails.some(email=>!validEmail(email)))throw Error('Enter a valid email address for each invitation.');
 return [...new Set(emails)];
}
