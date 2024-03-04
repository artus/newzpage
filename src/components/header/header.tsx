import Link from 'next/link';
import headerStyles from './header.module.scss';
import GlobeIcon from '../icons/globe-icon';
import { DateTime } from 'luxon';

export default function Header() {

  const date = DateTime.now().toLocaleString(DateTime.DATETIME_MED);

  return <header className={headerStyles.np_header}>
    <nav>
      <Link href="https://www.github.com/artus/newzpage">
        <GlobeIcon />
      </Link>
    </nav>
    <h1>Newzpage</h1>
    <div><p>{date}</p></div>
  </header>
}