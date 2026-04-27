import xlsx from 'xlsx';
const wb = xlsx.readFile('C:/Users/bickl/Downloads/67370_04242026_1128199760.xlsx', { cellDates: false });
const tab = process.argv[2] || 'DSCR Elite LLPAs';
const sheet = wb.Sheets[tab];
if (!sheet) {
  console.log(`Tab "${tab}" not found. Available:`);
  console.log(wb.SheetNames.filter(n => /elite|select/i.test(n)));
  process.exit(1);
}
const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: true });
console.log(`Total rows: ${data.length}`);
for (let i = 0; i < Math.min(data.length, 110); i++) {
  const row = data[i] || [];
  const cells = row.slice(0, 13).map(c => {
    if (c === null || c === undefined) return '·';
    if (typeof c === 'number') return c.toFixed(4).replace(/\.?0+$/, '') || '0';
    return String(c).slice(0, 22);
  });
  console.log(`r${String(i).padStart(3)}: ${cells.map(c => c.padEnd(8)).join(' ')}`);
}
