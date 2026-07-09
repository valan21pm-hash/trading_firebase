const epic1 = 'CS.D.EURUSD.CFD.IP';
const epic2 = 'CS.D.EURUSD.daily.IP';
const isDaily = epic2.toLowerCase().includes('daily') || epic2.toLowerCase().includes('dfb');
console.log(isDaily);
