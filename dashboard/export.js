/* Explicit string cells prevent user content from becoming spreadsheet formulas. */
export function columns(rows){return [...new Set(rows.flatMap(row=>Object.keys(row)))];}
export function display(value){return value==null?'':typeof value==='object'?JSON.stringify(value):String(value);}
export function workbook(XLSX,rows,details){
  const headers=columns(rows),cells=[headers.map(v=>({t:'s',v})),...rows.map(row=>headers.map(key=>{
    const v=row[key];if(v==null)return {t:'s',v:''};
    if(typeof v==='number'&&Number.isFinite(v))return {t:'n',v};if(typeof v==='boolean')return {t:'b',v};
    const text=display(v);if(text.length>32767)throw new Error('A report cell exceeds Excel’s text limit. Use a more specific report or narrower source.');
    return {t:'s',v:text};
  }))];
  const sheet=XLSX.utils.aoa_to_sheet(cells);sheet['!cols']=headers.map(h=>({wch:Math.min(45,Math.max(18,h.length+3))}));
  if(headers.length)sheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:rows.length,c:headers.length-1}})};
  const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Report');
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(Object.entries(details).map(([k,v])=>[{t:'s',v:k},{t:'s',v:display(v)}])),'Export details');
  return book;
}
