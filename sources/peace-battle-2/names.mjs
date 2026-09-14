// The name pool the board is built from. Invented, assembled from common given names and surnames.
// None was read from the Directory; with 147 residents a coincidental match with a real person is
// possible and would be a coincidence, because no name, place or skill here came from a row — only
// from counts.
//
// It lives in its own file because two things need it: the generator that writes residents.json, and
// the app, which has to name the people it finds mid-run.

export const GIVEN = ['Ada', 'Marcus', 'Imani', 'Tobias', 'Lena', 'Rosa', 'Nadia', 'Felix', 'Omar', 'Greta',
  'Yusuf', 'Clara', 'Dmitri', 'Amara', 'Piotr', 'Sofia', 'Kwame', 'Elin', 'Hassan', 'Mira',
  'Joaquin', 'Tessa', 'Rafael', 'Noor', 'Bo', 'Ingrid', 'Malik', 'Junia', 'Arne', 'Petra',
  'Caleb', 'Yara', 'Soren', 'Delia', 'Nikolai', 'Esme', 'Tariq', 'Wren', 'Anders', 'Leila',
  'Gideon', 'Marta', 'Ravi', 'Coral', 'Emeka', 'Astrid', 'Silas', 'Nia', 'Bruno', 'Ilse'];

export const SURNAME = ['Okonkwo', 'Varga', 'Delacroix', 'Mbeki', 'Lindqvist', 'Ferreira', 'Haddad', 'Novak',
  'Osei', 'Reyes', 'Bergman', 'Aziz', 'Kowalski', 'Santos', 'Ndiaye', 'Whitfield', 'Ibarra', 'Petrov',
  'Adeyemi', 'Mercier', 'Halvorsen', 'Rahman', 'Castellano', 'Owusu', 'Lindgren', 'Baptiste',
  'Fontaine', 'Achebe', 'Marek', 'Vasquez'];
