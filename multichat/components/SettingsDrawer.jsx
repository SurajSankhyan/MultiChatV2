import React, { useState, useEffect, useRef } from 'react';
import { Sliders, X, Copy, Check, Plus, Trash2, Tv, Loader2, Info, ExternalLink, ShieldAlert, Key, Gem, User } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import PlatformLogo from './PlatformLogo';
import AnimatedDropdown from './ui/animated-dropdown';
import PairingCodeModal from './PairingCodeModal';

const TelevisionIcon = ({ size = 16, className, style }) => (
  <svg 
    viewBox="0 0 512 512" 
    width={size} 
    height={size} 
    className={className} 
    style={{ fill: 'currentColor', display: 'inline-block', verticalAlign: 'middle', ...style }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 0 C5.15305163 3.00247849 9.11373482 6.84059797 13.29052734 11.06347656 C13.99366058 11.76631775 14.69679382 12.46915894 15.42123413 13.19329834 C17.730911 15.50436218 20.03343365 17.82241651 22.3359375 20.140625 C23.94118248 21.74960235 25.54687126 23.35813704 27.15298462 24.96624756 C31.36924852 29.19013022 35.57947037 33.41998558 39.78845215 37.65112305 C44.08840027 41.9715674 48.39404933 46.28632207 52.69921875 50.6015625 C61.13839428 59.06215695 69.57119618 67.52907365 78 76 C80.89555699 74.68957007 82.95344259 73.29261319 85.1875 71.03955078 C85.79303711 70.43387268 86.39857422 69.82819458 87.02246094 69.2041626 C87.67504883 68.54124207 88.32763672 67.87832153 89 67.1953125 C89.69641602 66.49597595 90.39283203 65.7966394 91.11035156 65.07611084 C92.62071557 63.55814014 94.12876469 62.03786344 95.63476562 60.51556396 C98.01743279 58.10738052 100.40628312 55.70549091 102.796875 53.30517578 C107.87018426 48.20900186 112.9356386 43.105064 118 38 C123.86810865 32.08472898 129.73937212 26.17266522 135.61914062 20.26898193 C137.9741667 17.90097568 140.32309501 15.52703145 142.671875 13.15283203 C144.11428698 11.70315559 145.55698016 10.25375887 147 8.8046875 C147.65258789 8.14176697 148.30517578 7.47884644 148.97753906 6.7958374 C149.58307617 6.1901593 150.18861328 5.5844812 150.8125 4.96044922 C151.33457031 4.43393768 151.85664063 3.90742615 152.39453125 3.36495972 C156.94062438 -0.50010087 161.32053887 -0.42472187 167.0859375 -0.3125 C172.38740101 0.25602156 174.83972495 2.77865784 178.375 6.5 C180.72325726 11.55778486 180.97097307 16.51685793 180 22 C177.31943935 26.49586473 174.11302647 30.1663763 170.40527344 33.82177734 C169.85848938 34.36885345 169.31170532 34.91592957 168.74835205 35.47958374 C166.95673045 37.26982243 165.1581509 39.05288988 163.359375 40.8359375 C162.10912101 42.08245767 160.85931058 43.32942287 159.60992432 44.57681274 C156.33298272 47.846147 153.05007796 51.10942824 149.76586914 54.37145996 C146.41058308 57.70622502 143.06100716 61.04671484 139.7109375 64.38671875 C133.14618201 70.93007549 126.57510874 77.46704798 120 84 C120.91327938 84.00219984 120.91327938 84.00219984 121.84500885 84.00444412 C136.73024781 84.04166206 151.61528081 84.10087299 166.50032806 84.18390274 C173.69895246 84.22353889 180.89746999 84.256009 188.09619141 84.27099609 C194.37811648 84.28409335 200.65980485 84.31126053 206.94159651 84.35461307 C210.2610775 84.37704926 213.58001563 84.39082076 216.89961243 84.39188385 C244.39804678 84.4095341 266.03927671 88.92622601 286.53125 108.40625 C306.09268018 129.03953937 309.47223647 153.41726936 309.38818359 180.50805664 C309.39225729 182.73235836 309.39760361 184.95665806 309.40411377 187.18095398 C309.41769748 193.17674144 309.41252611 199.17237267 309.40297651 205.16816258 C309.39533423 211.46851193 309.40243805 217.76884869 309.40713501 224.06919861 C309.41292672 235.3201812 309.40365663 246.57109993 309.388357 257.82206749 C309.37495339 267.99314822 309.3772884 278.16412619 309.39111328 288.33520508 C309.40721968 300.1901103 309.41311662 312.0449659 309.40427649 323.89988416 C309.39961914 330.15942215 309.39892158 336.41888958 309.40888596 342.67842293 C309.417603 348.56453627 309.41144767 354.45045705 309.39420319 360.33654976 C309.39026372 362.48624859 309.39132836 364.63596386 309.39799118 366.78565598 C309.47086283 392.70212098 304.55401317 416.06309493 285.8046875 435.25 C268.08405336 452.62510646 246.76919038 459.1584128 222.30090332 459.14044189 C221.03128864 459.14341302 219.76167396 459.14638414 218.4535861 459.1494453 C214.94525559 459.1574723 211.43694559 459.15930246 207.92860699 459.16004276 C204.13835292 459.16190087 200.3481093 459.16945203 196.55786133 459.17617798 C188.27653459 459.18973172 179.99521271 459.19578154 171.71387672 459.20018864 C166.53698754 459.20295635 161.36010021 459.20719468 156.18321228 459.21169281 C141.83304207 459.22388213 127.48287333 459.23418177 113.13269806 459.2375679 C111.75631494 459.23789725 111.75631494 459.23789725 110.35212609 459.23823325 C108.97255866 459.23856067 108.97255866 459.23856067 107.56512117 459.2388947 C105.70161724 459.23933816 103.83811331 459.23978472 101.97460938 459.24023438 C101.05025855 459.2404558 100.12590772 459.24067723 99.17354625 459.24090537 C84.20836609 459.24485023 69.24323471 459.26229624 54.27807337 459.2855939 C38.89149206 459.30935304 23.50493519 459.32177184 8.11833525 459.32293582 C-0.51170797 459.32385007 -9.14168763 459.32953913 -17.77171326 459.34775543 C-25.12285165 459.36321821 -32.47390682 459.3682407 -39.8250584 459.36001733 C-43.56985164 459.35613243 -47.31447763 459.35693351 -51.05924988 459.37107468 C-79.81939567 459.4732856 -105.64197649 456.91991523 -127.25 435.8046875 C-147.38368995 415.27061167 -151.31062503 391.68409638 -151.2746582 363.96191406 C-151.27901124 361.73982574 -151.28419635 359.51773892 -151.29014587 357.2956543 C-151.30348457 351.28720071 -151.30412018 345.27881023 -151.30158257 339.27034473 C-151.30050921 334.24094128 -151.30540565 329.2115504 -151.310188 324.18214965 C-151.32189805 311.63094375 -151.3210683 299.07976831 -151.31463119 286.52856228 C-151.30946632 275.66340088 -151.32071053 264.79832926 -151.33972941 253.93318561 C-151.35916835 242.7410812 -151.36706265 231.54900939 -151.36360615 220.35688567 C-151.36179982 214.08774793 -151.36436421 207.81869239 -151.37832069 201.54956818 C-151.390965 195.64956223 -151.3888928 189.74973489 -151.37590981 183.84973145 C-151.37355867 181.6956145 -151.37622563 179.54148472 -151.38453293 177.38738251 C-151.48171138 150.20972847 -146.25863464 126.79149129 -126.72265625 106.65234375 C-111.09005188 91.8811795 -92.14616182 84.72296783 -70.87084961 84.68115234 C-69.09860519 84.66608391 -69.09860519 84.66608391 -67.29055786 84.65071106 C-63.4111578 84.61998429 -59.53182643 84.60287295 -55.65234375 84.5859375 C-52.95234215 84.56829205 -50.25236477 84.54773821 -47.55238342 84.5272522 C-41.18846693 84.48062241 -34.8245337 84.44380231 -28.46053463 84.41057932 C-21.21010734 84.37224568 -13.95976814 84.32286531 -6.70941532 84.27259517 C8.19365787 84.16951059 23.09678462 84.08017452 38 84 C36.91671921 82.92338104 36.91671921 82.92338104 35.81155396 81.82501221 C29.00808299 75.06207508 22.20989184 68.29387041 15.41684151 61.52046585 C11.92425493 58.03831885 8.42983129 54.55805776 4.93115234 51.08203125 C1.55515438 47.72775521 -1.81594235 44.36862496 -5.18368912 41.00606537 C-6.46975281 39.72369858 -7.75757628 38.44309415 -9.04717636 37.16428375 C-10.85237731 35.37358883 -12.65123402 33.57674426 -14.44873047 31.77832031 C-14.98388275 31.25035858 -15.51903503 30.72239685 -16.07040405 30.17843628 C-20.65853049 25.56460684 -22.29234199 22.62191962 -22.375 16.125 C-22.27363418 10.91733093 -21.69948398 7.89419367 -18 4 C-12.87322962 -0.87043186 -6.74482111 -1.1943954 0 0 Z M26.1875 209.25 C19.32529111 218.72335102 17.84721978 228.50723465 17.85473633 239.96972656 C17.85137772 240.72215134 17.8480191 241.47457611 17.84455872 242.24980164 C17.83513549 244.71342668 17.83310989 247.17698311 17.83203125 249.640625 C17.82881236 251.37164334 17.82544782 253.10266141 17.82194519 254.8336792 C17.81597523 258.45471832 17.81410306 262.07573365 17.81469727 265.69677734 C17.81479869 270.30723462 17.80115718 274.91753721 17.78392506 279.52795792 C17.77273484 283.1021798 17.77078021 286.67636513 17.77130699 290.25060272 C17.77013702 291.94883506 17.76577137 293.64706866 17.75797462 295.34528351 C17.69255128 311.06813544 18.05068392 325.46558525 29.125 337.8125 C37.86700554 345.94687736 48.4187398 348.50627937 59.94140625 348.26171875 C77.90887089 347.4186585 97.23359664 329.22038118 111.5625 319.5 C114.35903565 317.60651991 117.1561139 315.71384456 119.95343018 313.82151794 C121.7630322 312.59697378 123.57208375 311.37161571 125.3805542 310.145401 C129.41767892 307.41026942 133.46098004 304.6867949 137.53417969 302.00561523 C138.56840309 301.32366089 138.56840309 301.32366089 139.6235199 300.62792969 C140.87841004 299.80260573 142.13558848 298.98074436 143.39564514 298.16333008 C152.45941112 292.20140239 158.04001006 284.06324974 160.6171875 273.4609375 C162.24974594 262.96591898 160.20105087 253.74483318 154.37890625 244.88671875 C146.47934273 234.07796753 134.56835545 229.05086536 122.83984375 223.203125 C121.39964101 222.48073612 119.9595855 221.75805365 118.51966858 221.03509521 C115.52218012 219.53191765 112.52250364 218.033223 109.52124023 216.53759766 C105.69839762 214.63193625 101.88207062 212.71361168 98.06737423 210.79170609 C95.1025909 209.30009476 92.13407765 207.81603043 89.16446114 206.3340683 C87.75639333 205.63011043 86.34954289 204.92371151 84.9440136 204.21469879 C64.57331043 193.95149389 42.77383446 189.28301138 26.1875 209.25 Z " transform="translate(177,27)" />
    <path d="M0 0 C3.92207478 0.29538862 6.80192576 1.55198318 10.2429657 3.31121826 C10.90226578 3.63641449 11.56156586 3.96161072 12.24084473 4.29666138 C14.4075904 5.36942296 16.56516818 6.45932078 18.72270203 7.55047607 C20.23113708 8.30394208 21.73995771 9.05663663 23.24914551 9.80859375 C26.40593777 11.38482648 29.55834037 12.96942915 32.70780945 14.5602417 C36.74220016 16.59733974 40.78611328 18.61462658 44.83341503 20.62592697 C47.94865971 22.17645446 51.05897525 23.73666158 54.16785622 25.29990387 C55.65716932 26.04748233 57.147916 26.79221195 58.64011192 27.53401947 C60.72501476 28.57247039 62.80301329 29.62361049 64.87968445 30.67840576 C65.80314163 31.13372177 65.80314163 31.13372177 66.74525452 31.59823608 C70.14144477 33.34283394 72.46226481 34.90349585 74.36723328 38.25360107 C74.61723328 41.06610107 74.61723328 41.06610107 73.36723328 44.25360107 C67.67356498 49.51485213 60.9045781 53.67606526 54.42582703 57.89422607 C53.49988235 58.50191833 52.57393768 59.1096106 51.61993408 59.73571777 C48.68387568 61.66194814 45.74455237 63.58311624 42.80473328 65.50360107 C39.89952814 67.40452879 36.99508948 69.30660437 34.09199524 71.21075439 C32.19955458 72.45150932 30.30566687 73.69006015 28.41029358 74.92633057 C24.09641095 77.75064028 19.82650769 80.60899536 15.64506531 83.62664795 C14.92271194 84.14378357 14.20035858 84.66091919 13.45611572 85.19372559 C12.13658001 86.14576227 10.826608 87.11127667 9.52920532 88.09326172 C5.35817285 91.09702455 2.47024311 91.84486798 -2.63276672 91.25360107 C-5.24869825 89.42244901 -5.60266128 88.34391741 -6.63276672 85.25360107 C-6.73888637 82.7402349 -6.78999707 80.25418511 -6.79389954 77.74041748 C-6.79886444 76.97747879 -6.80382935 76.2145401 -6.8089447 75.42848206 C-6.82355218 72.90403339 -6.83036574 70.37964756 -6.83589172 67.85516357 C-6.84164407 66.10022988 -6.84740179 64.34529621 -6.85316467 62.59036255 C-6.86367045 58.91007189 -6.86951597 55.22980305 -6.8730011 51.54949951 C-6.87848683 46.83613468 -6.90251827 42.12305858 -6.93097305 37.40978432 C-6.94960561 33.78436441 -6.95480535 30.159014 -6.95633698 26.53355026 C-6.95936233 24.7960286 -6.96738691 23.05850812 -6.98052216 21.32103348 C-6.99759678 18.88899058 -6.99569924 16.45765242 -6.98921204 14.02557373 C-6.99842682 13.3095549 -7.0076416 12.59353607 -7.01713562 11.8558197 C-6.97389256 6.67474545 -5.9021424 0.56852346 0 0 Z " transform="translate(232.6327667236328,252.74639892578125)" />
  </svg>
);

const popularFonts = [
  { id: 'inherit', name: 'System Default' },
  { id: 'Inter', name: 'Inter' },
  { id: 'Roboto', name: 'Roboto' },
  { id: 'Outfit', name: 'Outfit' },
  { id: 'Montserrat', name: 'Montserrat' },
  { id: 'Nunito', name: 'Nunito' },
  { id: 'Fira Code', name: 'Fira Code' },
  { id: 'Open Sans', name: 'Open Sans' },
  { id: 'Lato', name: 'Lato' },
  { id: 'Poppins', name: 'Poppins' },
  { id: 'Oswald', name: 'Oswald' },
  { id: 'Lilita One', name: 'Lilita One' },
  { id: 'Bebas Neue', name: 'Bebas Neue' },
  { id: 'Lobster', name: 'Lobster' },
  { id: 'Press Start 2P', name: 'Press Start 2P' },
  { id: 'ABeeZee', name: 'ABeeZee' },
  { id: 'Abel', name: 'Abel' },
  { id: 'Abhaya Libre', name: 'Abhaya Libre' },
  { id: 'Aboreto', name: 'Aboreto' },
  { id: 'Abril Fatface', name: 'Abril Fatface' },
  { id: 'Abyssinica SIL', name: 'Abyssinica SIL' },
  { id: 'Aclonica', name: 'Aclonica' },
  { id: 'Acme', name: 'Acme' },
  { id: 'Actor', name: 'Actor' },
  { id: 'Adamina', name: 'Adamina' },
  { id: 'ADLaM Display', name: 'ADLaM Display' },
  { id: 'Advent Pro', name: 'Advent Pro' },
  { id: 'Afacad', name: 'Afacad' },
  { id: 'Afacad Flux', name: 'Afacad Flux' },
  { id: 'Agbalumo', name: 'Agbalumo' },
  { id: 'Agdasima', name: 'Agdasima' },
  { id: 'Agu Display', name: 'Agu Display' },
  { id: 'Aguafina Script', name: 'Aguafina Script' },
  { id: 'Akatab', name: 'Akatab' },
  { id: 'Akaya Kanadaka', name: 'Akaya Kanadaka' },
  { id: 'Akaya Telivigala', name: 'Akaya Telivigala' },
  { id: 'Akronim', name: 'Akronim' },
  { id: 'Akshar', name: 'Akshar' },
  { id: 'Aladin', name: 'Aladin' },
  { id: 'Alata', name: 'Alata' },
  { id: 'Alatsi', name: 'Alatsi' },
  { id: 'Albert Sans', name: 'Albert Sans' },
  { id: 'Aldrich', name: 'Aldrich' },
  { id: 'Alef', name: 'Alef' },
  { id: 'Alegreya', name: 'Alegreya' },
  { id: 'Alegreya Sans', name: 'Alegreya Sans' },
  { id: 'Alegreya Sans SC', name: 'Alegreya Sans SC' },
  { id: 'Alegreya SC', name: 'Alegreya SC' },
  { id: 'Aleo', name: 'Aleo' },
  { id: 'Alex Brush', name: 'Alex Brush' },
  { id: 'Alexandria', name: 'Alexandria' },
  { id: 'Alfa Slab One', name: 'Alfa Slab One' },
  { id: 'Alice', name: 'Alice' },
  { id: 'Alike', name: 'Alike' },
  { id: 'Alike Angular', name: 'Alike Angular' },
  { id: 'Alkalami', name: 'Alkalami' },
  { id: 'Alkatra', name: 'Alkatra' },
  { id: 'Allan', name: 'Allan' },
  { id: 'Allerta', name: 'Allerta' },
  { id: 'Allerta Stencil', name: 'Allerta Stencil' },
  { id: 'Allison', name: 'Allison' },
  { id: 'Allura', name: 'Allura' },
  { id: 'Almarai', name: 'Almarai' },
  { id: 'Almendra', name: 'Almendra' },
  { id: 'Almendra Display', name: 'Almendra Display' },
  { id: 'Almendra SC', name: 'Almendra SC' },
  { id: 'Alumni Sans', name: 'Alumni Sans' },
  { id: 'Alumni Sans Collegiate One', name: 'Alumni Sans Collegiate One' },
  { id: 'Alumni Sans Inline One', name: 'Alumni Sans Inline One' },
  { id: 'Alumni Sans Pinstripe', name: 'Alumni Sans Pinstripe' },
  { id: 'Alumni Sans SC', name: 'Alumni Sans SC' },
  { id: 'Alyamama', name: 'Alyamama' },
  { id: 'Amarante', name: 'Amarante' },
  { id: 'Amaranth', name: 'Amaranth' },
  { id: 'Amatic SC', name: 'Amatic SC' },
  { id: 'Amethysta', name: 'Amethysta' },
  { id: 'Amiko', name: 'Amiko' },
  { id: 'Amiri', name: 'Amiri' },
  { id: 'Amiri Quran', name: 'Amiri Quran' },
  { id: 'Amita', name: 'Amita' },
  { id: 'Anaheim', name: 'Anaheim' },
  { id: 'Andada Pro', name: 'Andada Pro' },
  { id: 'Andika', name: 'Andika' },
  { id: 'Anek Bangla', name: 'Anek Bangla' },
  { id: 'Anek Devanagari', name: 'Anek Devanagari' },
  { id: 'Anek Gujarati', name: 'Anek Gujarati' },
  { id: 'Anek Gurmukhi', name: 'Anek Gurmukhi' },
  { id: 'Anek Kannada', name: 'Anek Kannada' },
  { id: 'Anek Latin', name: 'Anek Latin' },
  { id: 'Anek Malayalam', name: 'Anek Malayalam' },
  { id: 'Anek Odia', name: 'Anek Odia' },
  { id: 'Anek Tamil', name: 'Anek Tamil' },
  { id: 'Anek Telugu', name: 'Anek Telugu' },
  { id: 'Angkor', name: 'Angkor' },
  { id: 'Annapurna SIL', name: 'Annapurna SIL' },
  { id: 'Annie Use Your Telescope', name: 'Annie Use Your Telescope' },
  { id: 'Anonymous Pro', name: 'Anonymous Pro' },
  { id: 'Anta', name: 'Anta' },
  { id: 'Antic', name: 'Antic' },
  { id: 'Antic Didone', name: 'Antic Didone' },
  { id: 'Antic Slab', name: 'Antic Slab' },
  { id: 'Anton', name: 'Anton' },
  { id: 'Anton SC', name: 'Anton SC' },
  { id: 'Antonio', name: 'Antonio' },
  { id: 'Anuphan', name: 'Anuphan' },
  { id: 'Anybody', name: 'Anybody' },
  { id: 'Aoboshi One', name: 'Aoboshi One' },
  { id: 'AR One Sans', name: 'AR One Sans' },
  { id: 'Arapey', name: 'Arapey' },
  { id: 'Arbutus', name: 'Arbutus' },
  { id: 'Arbutus Slab', name: 'Arbutus Slab' },
  { id: 'Architects Daughter', name: 'Architects Daughter' },
  { id: 'Archivo', name: 'Archivo' },
  { id: 'Archivo Black', name: 'Archivo Black' },
  { id: 'Archivo Narrow', name: 'Archivo Narrow' },
  { id: 'Aref Ruqaa', name: 'Aref Ruqaa' },
  { id: 'Aref Ruqaa Ink', name: 'Aref Ruqaa Ink' },
  { id: 'Arima', name: 'Arima' },
  { id: 'Arimo', name: 'Arimo' },
  { id: 'Arizonia', name: 'Arizonia' },
  { id: 'Armata', name: 'Armata' },
  { id: 'Arsenal', name: 'Arsenal' },
  { id: 'Arsenal SC', name: 'Arsenal SC' },
  { id: 'Artifika', name: 'Artifika' },
  { id: 'Arvo', name: 'Arvo' },
  { id: 'Arya', name: 'Arya' },
  { id: 'Asap', name: 'Asap' },
  { id: 'Asap Condensed', name: 'Asap Condensed' },
  { id: 'Asar', name: 'Asar' },
  { id: 'Asset', name: 'Asset' },
  { id: 'Assistant', name: 'Assistant' },
  { id: 'Astloch', name: 'Astloch' },
  { id: 'Asul', name: 'Asul' },
  { id: 'Athiti', name: 'Athiti' },
  { id: 'Atkinson Hyperlegible', name: 'Atkinson Hyperlegible' },
  { id: 'Atkinson Hyperlegible Mono', name: 'Atkinson Hyperlegible Mono' },
  { id: 'Atkinson Hyperlegible Next', name: 'Atkinson Hyperlegible Next' },
  { id: 'Atma', name: 'Atma' },
  { id: 'Atomic Age', name: 'Atomic Age' },
  { id: 'Aubrey', name: 'Aubrey' },
  { id: 'Audiowide', name: 'Audiowide' },
  { id: 'Autour One', name: 'Autour One' },
  { id: 'Average', name: 'Average' },
  { id: 'Average Sans', name: 'Average Sans' },
  { id: 'Averia Gruesa Libre', name: 'Averia Gruesa Libre' },
  { id: 'Averia Libre', name: 'Averia Libre' },
  { id: 'Averia Sans Libre', name: 'Averia Sans Libre' },
  { id: 'Averia Serif Libre', name: 'Averia Serif Libre' }
];

export default function SettingsDrawer({ 
  isOpen, 
  onClose, 
  settings, 
  updateSettings, 
  activeChannels,
  onAddChannel,
  removeChannel,
  toggleChannel,
  platformStatuses,
  blockedUsers,
  onUnblockUser,
  youtubeShortsChannels = new Set(),
  initialTab = 'appearance',
  user
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [appearanceSubtab, setAppearanceSubtab] = useState('display');
  const [copied, setCopied] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [innertubeConnected, setInnertubeConnected] = useState(false);
  const [deviceAuthInfo, setDeviceAuthInfo] = useState(null);
  const [innertubeCookie, setInnertubeCookie] = useState('');
  const [newWord, setNewWord] = useState('');

  const currentUserEmail = user?.email || (typeof window !== 'undefined' ? localStorage.getItem('prochat_user_email') : '');

  const [linkedChannel, setLinkedChannel] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    const checkConnected = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: { session } } = await supabase.auth.getSession();

        const activeEmail = session?.user?.email || user?.email || currentUserEmail;
        const activeUserId = session?.user?.id || user?.id;

        let ytData = null;

        if (activeEmail || activeUserId) {
          const conds = [];
          if (activeUserId) conds.push(`id.eq.${activeUserId}`);
          if (activeEmail) conds.push(`email.eq.${activeEmail}`);

          const { data } = await supabase
            .from('Youtube')
            .select('custom_handle, channel_name, channel_id, avatar_url, youtube_cookie, youtube_refresh_token')
            .or(conds.join(','))
            .limit(1);

          if (data && data.length > 0) {
            ytData = data[0];
          }
        }

        if (ytData && (ytData.channel_name || ytData.custom_handle || ytData.channel_id)) {
          setLinkedChannel(ytData);
          setYoutubeConnected(true);
          setInnertubeConnected(true);
        } else {
          setLinkedChannel(null);
          setYoutubeConnected(false);
          setInnertubeConnected(false);
        }
      } catch (e) {
        console.error('[SettingsDrawer] checkConnected error:', e);
      }
    };
    checkConnected();
  }, [isOpen, user, currentUserEmail]);
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPreviewIndex(prev => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = React.useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200); // 200ms exit animation
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  // Local state for channel form
  const [platform, setPlatform] = useState('twitch');
  const [channelName, setChannelName] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Font selector ref and autocomplete states
  const fontSelectRef = useRef(null);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const [isFontDropdownOpen, setIsFontDropdownOpen] = useState(false);

  // TTS Voices Hook
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const updateVoices = () => {
      try {
        const allVoices = window.speechSynthesis.getVoices() || [];
        const sortedVoices = [...allVoices].sort((a, b) => {
          const aLang = (a?.lang || '').toLowerCase();
          const aName = (a?.name || '').toLowerCase();
          const bLang = (b?.lang || '').toLowerCase();
          const bName = (b?.name || '').toLowerCase();
          const aIsIndian = aLang.includes('in') || aName.includes('india') || aName.includes('hindi');
          const bIsIndian = bLang.includes('in') || bName.includes('india') || bName.includes('hindi');
          if (aIsIndian && !bIsIndian) return -1;
          if (!aIsIndian && bIsIndian) return 1;
          return (a?.name || '').localeCompare(b?.name || '');
        });
        setVoices(sortedVoices);
      } catch (e) {
        console.warn('Speech synthesis voices update notice:', e);
      }
    };
    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Sync fontSearchQuery when settings.fontFamily changes
  useEffect(() => {
    if (!settings.fontFamily || settings.fontFamily === 'inherit') {
      setFontSearchQuery('');
    } else {
      const matched = popularFonts.find(f => f.id === settings.fontFamily);
      setFontSearchQuery(matched ? matched.name : settings.fontFamily);
    }
  }, [settings.fontFamily]);

  // Click outside font dropdown handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fontSelectRef.current && !fontSelectRef.current.contains(event.target)) {
        setIsFontDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Dynamically load selected Google Font in head
  const loadGoogleFont = (fontFamily) => {
    if (!fontFamily || fontFamily === 'inherit') return;
    const linkId = `gfont-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(linkId)) return;
    
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap`;
    document.head.appendChild(link);
  };

  useEffect(() => {
    if (settings.fontFamily) {
      loadGoogleFont(settings.fontFamily);
    }
  }, [settings.fontFamily]);

  const handleSelectFont = (font) => {
    updateSettings({ fontFamily: font.id });
    setFontSearchQuery(font.name === 'System Default' ? '' : font.name);
    setIsFontDropdownOpen(false);
  };

  const handleResetFont = () => {
    updateSettings({ fontFamily: 'inherit' });
    setFontSearchQuery('');
    setIsFontDropdownOpen(false);
  };


  const handleChannelSubmit = async (e) => {
    e.preventDefault();
    const name = channelName.trim();
    if (!name) return;
    setValidationError('');
    setIsValidating(true);
    try {
      await onAddChannel(platform, name);
      setChannelName('');
    } catch (err) {
      setValidationError(err.message || 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Generate OBS Overlay URL
  const getOverlayUrl = () => {
    const origin = window.location.origin;
    const channelNames = activeChannels.map(ch => `${ch.platform}:${ch.name}`).join(',');
    const params = new URLSearchParams();
    
    if (channelNames) params.append('channels', channelNames);
    if (settings.chatStyle) params.append('chatStyle', settings.chatStyle);
    if (settings.textSize) params.append('textSize', settings.textSize);
    if (settings.showTimestamps !== undefined) params.append('showTimestamps', settings.showTimestamps);
    if (settings.showIcons !== undefined) params.append('showIcons', settings.showIcons);
    if (settings.showBadges !== undefined) params.append('showBadges', settings.showBadges);
    if (settings.showLevelBadges !== undefined) params.append('showLevelBadges', settings.showLevelBadges);
    if (settings.showChannelName !== undefined) params.append('showChannelName', settings.showChannelName);
    if (settings.removeAtSymbol !== undefined) params.append('removeAtSymbol', settings.removeAtSymbol);
    if (settings.theme) params.append('theme', settings.theme);
    if (settings.fontFamily) params.append('fontFamily', settings.fontFamily);
    
    // New parameters
    if (settings.showYoutubeProfilePictures !== undefined) params.append('showYoutubeProfilePictures', settings.showYoutubeProfilePictures);
    if (settings.showTwitchProfilePictures !== undefined) params.append('showTwitchProfilePictures', settings.showTwitchProfilePictures);
    if (settings.showKickProfilePictures !== undefined) params.append('showKickProfilePictures', settings.showKickProfilePictures);
    if (settings.hideBotMessages !== undefined) params.append('hideBotMessages', settings.hideBotMessages);
    if (settings.randomNameColors !== undefined) params.append('randomNameColors', settings.randomNameColors);
    if (settings.overlayFadeTime !== undefined) params.append('overlayFadeTime', settings.overlayFadeTime);
    if (settings.overlayTextOutline !== undefined) params.append('overlayTextOutline', settings.overlayTextOutline);
    if (settings.overlayTextShadow) params.append('overlayTextShadow', settings.overlayTextShadow);
    if (settings.overlayCustomCss) params.append('customCss', settings.overlayCustomCss);

    return `${origin}/overlay?${params.toString()}`;
  };

  const [highlightCopied, setHighlightCopied] = useState(false);

  const getHighlightOverlayUrl = () => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const params = new URLSearchParams();
    params.append('mode', 'highlight');
    if (settings.highlightShowPlatformLogo) params.append('showSocialLogo', 'true');
    if (settings.highlightAuthorBgColor && settings.highlightAuthorBgColor !== '#ffa500') params.append('authorBg', settings.highlightAuthorBgColor);
    if (settings.highlightAuthorTextColor && settings.highlightAuthorTextColor !== '#222222') params.append('authorColor', settings.highlightAuthorTextColor);
    if (settings.highlightCommentBgColor && settings.highlightCommentBgColor !== '#222222') params.append('commentBg', settings.highlightCommentBgColor);
    if (settings.highlightCommentTextColor && settings.highlightCommentTextColor !== '#ffffff') params.append('commentColor', settings.highlightCommentTextColor);
    if (settings.highlightFirstNameOnly) params.append('firstNameOnly', 'true');
    if (settings.fontFamily) params.append('fontFamily', settings.fontFamily);
    if (settings.overlayFadeTime !== undefined) params.append('autoHideSeconds', settings.overlayFadeTime);
    return `${origin}/overlay?${params.toString()}`;
  };

  const handleCopyHighlightUrl = () => {
    navigator.clipboard.writeText(getHighlightOverlayUrl());
    setHighlightCopied(true);
    setTimeout(() => setHighlightCopied(false), 2000);
  };

  const handleTestHighlight = () => {
    const testData = {
      chatId: 'test-' + Date.now(),
      displayName: user?.username || 'Sample User',
      username: 'sample_user',
      avatarUrl: user?.avatar && typeof user.avatar === 'string' && user.avatar.startsWith('http') ? user.avatar : 'https://yt3.ggpht.com/a/default-user=s88-c-k-c0x00ffffff-no-rj',
      text: '🔥 Stream Highlight Overlay is connected and looking crisp on stream!',
      parts: [{ type: 'text', content: '🔥 Stream Highlight Overlay is connected and looking crisp on stream!' }],
      platform: 'youtube',
      donationAmount: '₹500',
      amountValue: 500,
      isSuperChat: true,
      badges: ['member', 'moderator'],
      badgeImages: {
        member: 'https://yt3.ggpht.com/qLpx0c5tY4U2e18n2c27kC5vL1PzM3zK=s16-c-k'
      },
      isMember: true,
      isModerator: true,
      showPlatformLogo: !!settings.highlightShowPlatformLogo,
      autoHideSeconds: settings.overlayFadeTime || 8
    };

    try {
      const bc = new BroadcastChannel('multichat_highlight_overlay');
      bc.postMessage({ command: 'show', data: testData });
      setTimeout(() => bc.close(), 500);
      localStorage.setItem('multichat_active_highlight_event', JSON.stringify({ command: 'show', data: testData, timestamp: Date.now() }));
    } catch (e) {}

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey) {
        import('@/utils/supabase/client').then(({ createClient }) => {
          const supabase = createClient();
          const channel = supabase.channel('multichat_highlight_overlay', {
            config: { broadcast: { self: true } }
          });
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              channel.send({
                type: 'broadcast',
                event: 'highlight',
                payload: { command: 'show', data: testData }
              }).catch(() => {});
              setTimeout(() => channel.unsubscribe(), 1000);
            }
          });
        }).catch(() => {});
      }
    } catch (e) {}
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(getOverlayUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddBlocklistWord = (e) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    
    const word = newWord.trim().toLowerCase();
    if (!settings.blocklist.includes(word)) {
      updateSettings({
        blocklist: [...settings.blocklist, word]
      });
    }
    setNewWord('');
  };

  const handleRemoveBlocklistWord = (word) => {
    updateSettings({
      blocklist: settings.blocklist.filter(w => w !== word)
    });
  };

  const themes = [
    { id: 'default', name: 'Cyber Cyan' },
    { id: 'twitch', name: 'Twitch Purple' },
    { id: 'kick', name: 'Kick Green' },
    { id: 'youtube', name: 'YouTube Red' }
  ];

  const filteredFonts = popularFonts.filter(f => 
    f.name.toLowerCase().includes(fontSearchQuery.toLowerCase())
  ).slice(0, 50);

  // Helper to render live preview of chat styles
  const renderLivePreview = () => {
    const previewMessages = [
      {
        platform: 'kick',
        username: 'BunnySank',
        color: '#53fc18',
        text: <>example chat message <span style={{ color: 'var(--accent-color, #ff6060)', fontWeight: 600 }}>@ProChat</span></>,
        timestamp: '14:32'
      },
      {
        platform: 'youtube',
        username: 'YT_Gamer',
        color: '#ff4a4a',
        text: 'Checking out the new multi-chat dashboard! 🚀',
        timestamp: '14:33'
      },
      {
        platform: 'twitch',
        username: 'TwitchLover',
        color: '#a855f7',
        text: 'This overlay looks incredibly clean PogChamp',
        timestamp: '14:35'
      }
    ];

    const msg = previewMessages[previewIndex];

    return (
      <div className="settings-section-card" style={{ marginBottom: '12px' }}>
        <div className="settings-header-secondary">Live Chat Preview</div>
        <div 
          className="feed-messages" 
          style={{ 
            fontSize: `${settings.textSize || 15}px`, 
            fontFamily: settings.fontFamily === 'inherit' ? 'inherit' : settings.fontFamily || 'inherit',
            background: 'rgba(0,0,0,0.3)', 
            borderRadius: '6px',
            padding: '12px',
            border: '1px solid rgba(255,255,255,0.05)',
            maxHeight: '120px',
            overflow: 'hidden'
          }}
        >
          <div className={`feed-messages style-${settings.chatStyle || 'default'}`}>
            <div 
              key={previewIndex}
              className={`chat-message-row ${settings.alternatingBackgrounds ? 'row-even' : ''} preview-message-animated`} 
              style={{ border: 'none', background: 'none' }}
            >
              {(settings.showTimestamps || settings.showIcons) && (
                <div className="chat-message-meta-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '4px', flexShrink: 0, height: '1.5em' }}>
                  {settings.showTimestamps && (
                    <span className="msg-timestamp" style={{ userSelect: 'none' }}>{msg.timestamp}</span>
                  )}
                  {settings.showIcons && (
                    <span className="msg-platform-icon">
                      <PlatformLogo platform={msg.platform} size="0.9em" />
                    </span>
                  )}
                </div>
              )}
              <div className="chat-message-main-row" style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '4px', width: '100%' }}>
                <div className="message-body-inline" style={{ display: 'inline' }}>
                  <span className="msg-username" style={{ color: msg.color }}>{msg.username}</span>
                  <span className="msg-separator-space"> </span>
                  <span className="msg-text">
                    {msg.text}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      id="settings-modal" 
      className={`show-settings-modal ${isClosing ? 'closing' : ''}`} 
      onClick={handleClose}
    >
      <div 
        id="settings-modal-content" 
        className={isClosing ? 'closing' : ''}
        onClick={(e) => e.stopPropagation()}
        style={isClosing ? {
          animation: 'modalScaleOut 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        } : undefined}
      >
        <span id="settings-modal-close-button" onClick={handleClose}>&times;</span>
        
        {/* Left Side: Tabs */}
        <div id="settings-tabs-container">
          <button 
            className={`settings-tab ${activeTab === 'appearance' ? 'active' : ''}`} 
            onClick={() => setActiveTab('appearance')} 
            type="button"
          >
            <svg className="settings-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8,0 C12.4183,0 16,3.58172 16,8 C16,8.15958 15.9953,8.31807 15.9861,8.47533 C15.9328,9.38596 15.1095,10.0039 14.1974,10.0039 L11.0106,10.0039 C9.22875,10.0039 8.33642,12.1582 9.59635,13.4181 C10.4823,14.304 10.198,15.7959 8.95388,15.9437 C8.6411,15.9809 8.32278,16 8,16 C3.58172,16 0,12.4183 0,8 C0,3.58172 3.58172,0 8,0 Z M8,2 C4.68629,2 2,4.68629 2,8 C2,11.1538 4.4333,13.7393 7.52492,13.9815 C6.059,11.4506 7.82321,8.00391 11.0106,8.00391 L14,8.00391 C14,4.68629 11.3137,2 8,2 Z M5,8 C5.55228,8 6,8.44771 6,9 C6,9.55228 5.55228,10 5,10 C4.44772,10 4,9.55228 4,9 C4,8.44771 4.44772,8 5,8 Z M6,5 C6.55228,5 7,5.44772 7,6 C7,6.55228 6.55228,7 6,7 C5.44772,7 5,6.55228 5,6 C5,5.44772 5.44772,5 6,5 Z M9,4 C9.55228,4 10,4.44772 10,5 C10,5.55228 9.55228,6 9,6 C8.44771,6 8,5.55228 8,5 C8,4.44772 8.44771,4 9,4 Z"></path>
            </svg>
            <span className="settings-tab-label">Appearance</span>
          </button>
          
          <button 
            className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`} 
            onClick={() => setActiveTab('preferences')} 
            type="button"
          >
            <svg className="settings-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 5V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
              <path d="M12 5V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
              <path d="M18 5V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
              <path d="M8.5 16C8.5 17.3807 7.38071 18.5 6 18.5C4.61929 18.5 3.5 17.3807 3.5 16C3.5 14.6193 4.61929 13.5 6 13.5C7.38071 13.5 8.5 14.6193 8.5 16Z" fill="currentColor"></path>
              <path d="M14.5 9C14.5 10.3807 13.3807 11.5 12 11.5C10.6193 11.5 9.5 10.3807 9.5 9C9.5 7.61929 10.6193 6.5 12 6.5C13.3807 6.5 14.5 7.61929 14.5 9Z" fill="currentColor"></path>
              <path d="M20.5 16C20.5 17.3807 19.3807 18.5 18 18.5C16.6193 18.5 15.5 17.3807 15.5 16C15.5 14.6193 16.6193 13.5 18 13.5C19.3807 13.5 20.5 14.6193 20.5 16Z" fill="currentColor"></path>
            </svg>
            <span className="settings-tab-label">Preferences</span>
          </button>
          
          <button 
            className={`settings-tab ${activeTab === 'moderation' ? 'active' : ''}`} 
            onClick={() => setActiveTab('moderation')} 
            type="button"
          >
            <svg className="settings-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M11.2978,2.19533 C11.6939125,2.0467725 12.1254734,2.02820281 12.530448,2.13962094 L12.7022,2.19533 L19.7022,4.82033 C20.4308533,5.09354467 20.9298818,5.76181693 20.9931804,6.52752646 L21,6.69299 L21,12.0557 C21,15.3644353 19.185628,18.397435 16.2910032,19.9669788 L16.0249,20.1056 L12.6708,21.7826 C12.2954222,21.9703333 11.8610222,21.9911926 11.4725284,21.8451778 L11.3292,21.7826 L7.97508,20.1056 C5.01569824,18.6258412 3.11426678,15.6466349 3.00497789,12.3557015 L3,12.0557 L3,6.69299 C3,5.91487933 3.45049511,5.21294733 4.14521784,4.88481434 L4.29775,4.82033 L11.2978,2.19533 Z M12,4.06799 L5,6.69299 L5,12.0557 C5,14.61872 6.39981647,16.9691539 8.63528667,18.1940401 L8.8695,18.3167 L12,19.882 L15.1305,18.3167 C17.42295,17.1705233 18.8991628,14.8673176 18.9950298,12.3200442 L19,12.0557 L19,6.69299 L12,4.06799 Z M15.4329,8.62909 C15.8235,8.23856 16.4566,8.23856 16.8471,8.62909 C17.2076538,8.98957 17.2353888,9.55680503 16.9303047,9.9490935 L16.8471,10.0433 L11.6127,15.2778 C11.2137857,15.6767143 10.5847383,15.7052082 10.1529478,15.3632816 L10.057,15.2778 L7.65285,12.8736 C7.26233,12.4831 7.26233,11.8499 7.65285,11.4594 C8.01333923,11.0989385 8.58056645,11.0712107 8.97286152,11.3762166 L9.06707,11.4594 L10.8348,13.2272 L15.4329,8.62909 Z"></path>
            </svg>
            <span className="settings-tab-label">Moderation</span>
          </button>
          
          <button 
            className={`settings-tab ${activeTab === 'channels' ? 'active' : ''}`} 
            onClick={() => setActiveTab('channels')} 
            type="button"
          >
            <TelevisionIcon className="settings-tab-icon" size={18} />
            <span className="settings-tab-label">Channels</span>
          </button>
          
          <button 
            className={`settings-tab ${activeTab === 'connections' ? 'active' : ''}`} 
            onClick={() => setActiveTab('connections')} 
            type="button"
          >
            <svg className="settings-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M7.05025 1.53553C8.03344 0.552348 9.36692 0 10.7574 0C13.6528 0 16 2.34721 16 5.24264C16 6.63308 15.4477 7.96656 14.4645 8.94975L12.4142 11L11 9.58579L13.0503 7.53553C13.6584 6.92742 14 6.10264 14 5.24264C14 3.45178 12.5482 2 10.7574 2C9.89736 2 9.07258 2.34163 8.46447 2.94975L6.41421 5L5 3.58579L7.05025 1.53553Z"></path>
              <path d="M7.53553 13.0503L9.58579 11L11 12.4142L8.94975 14.4645C7.96656 15.4477 6.63308 16 5.24264 16C2.34721 16 0 13.6528 0 10.7574C0 9.36693 0.552347 8.03344 1.53553 7.05025L3.58579 5L5 6.41421L2.94975 8.46447C2.34163 9.07258 2 9.89736 2 10.7574C2 12.5482 3.45178 14 5.24264 14C6.10264 14 6.92742 13.6584 7.53553 13.0503Z"></path>
              <path d="M5.70711 11.7071L11.7071 5.70711L10.2929 4.29289L4.29289 10.2929L5.70711 11.7071Z"></path>
            </svg>
            <span className="settings-tab-label">Connections</span>
          </button>
          
          <button 
            className={`settings-tab ${activeTab === 'overlay' ? 'active' : ''}`} 
            onClick={() => setActiveTab('overlay')} 
            type="button"
          >
            <svg className="settings-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M11 1H1V3H11V1Z"></path>
              <path d="M1 5H15V7H1V5Z"></path>
              <path d="M11 9H1V11H11V9Z"></path>
              <path d="M15 13H1V15H15V13Z"></path>
            </svg>
            <span className="settings-tab-label">Overlay</span>
          </button>

          <button 
            className={`settings-tab ${activeTab === 'premium' ? 'active' : ''}`} 
            onClick={() => setActiveTab('premium')} 
            type="button"
          >
            <svg className="settings-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" aria-hidden="true">
              <path d="M20.75 3C21.0557 3 21.3421 3.13962 21.5303 3.3746L21.6048 3.48102L25.8548 10.481C26.0556 10.8118 26.0459 11.2249 25.8395 11.5435L25.7634 11.6459L14.7634 24.6459C14.3906 25.0865 13.7317 25.1159 13.3207 24.7341L13.2366 24.6459L2.23662 11.6459C1.98663 11.3505 1.93182 10.941 2.08605 10.5941L2.14522 10.481L6.39522 3.48102C6.55388 3.21969 6.82182 3.04741 7.1204 3.00842L7.25001 3H20.75ZM17.515 12H10.484L13.999 20.672L17.515 12ZM22.844 12H19.673L16.756 19.195L22.844 12ZM8.326 12H5.155L11.242 19.193L8.326 12ZM9.674 5H7.81101L4.775 10H8.245L9.674 5ZM16.246 5H11.753L10.324 10H17.675L16.246 5ZM20.188 5H18.325L19.754 10H23.224L20.188 5Z"></path>
            </svg>
            <span className="settings-tab-label">Premium</span>
          </button>
          
          <button 
            className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`} 
            onClick={() => setActiveTab('account')} 
            type="button"
          >
            <svg className="settings-tab-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" aria-hidden="true">
              <path d="M69.3677,51.0059a30,30,0,1,0-42.7354,0A41.9971,41.9971,0,0,0,0,90a5.9966,5.9966,0,0,0,6,6H90a5.9966,5.9966,0,0,0,6-6A41.9971,41.9971,0,0,0,69.3677,51.0059ZM48,12A18,18,0,1,1,30,30,18.02,18.02,0,0,1,48,12ZM12.5977,84A30.0624,30.0624,0,0,1,42,60H54A30.0624,30.0624,0,0,1,83.4023,84Z"></path>
            </svg>
            <span className="settings-tab-label">Account</span>
          </button>
        </div>
        
        {/* Right Side: Tab Contents */}
        <div id="settings-tab-content">
          
          {/* TAB 1: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="settings-section" id="appearance">
              <div className="settings-appearance-subtabs-container" role="tablist">
                <button 
                  className={`settings-appearance-subtab ${appearanceSubtab === 'display' ? 'active' : ''}`} 
                  onClick={() => setAppearanceSubtab('display')} 
                  type="button"
                >
                  Display
                </button>
                <button 
                  className={`settings-appearance-subtab ${appearanceSubtab === 'behavior' ? 'active' : ''}`} 
                  onClick={() => setAppearanceSubtab('behavior')} 
                  type="button"
                >
                  Behavior
                </button>
                <button 
                  className={`settings-appearance-subtab ${appearanceSubtab === 'emotes' ? 'active' : ''}`} 
                  onClick={() => setAppearanceSubtab('emotes')} 
                  type="button"
                >
                  Emotes
                </button>
              </div>

              {/* Subtab Panel: Display */}
              {appearanceSubtab === 'display' && (
                <div className="settings-appearance-subtab-panel active">
                  {renderLivePreview()}
                  
                  <div className="settings-section-card">
                    <div className="settings-header-secondary">Layout Settings</div>
                    
                    <div className="settings-appearance-font-container" ref={fontSelectRef}>
                      <label htmlFor="settings-appearance-message-font-select" className="settings-font-label">
                        Font
                        <svg className="settings-info-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16px" height="16px" data-tippy-content="Only applies to chat message text, not other UI elements.">
                          <path d="M0 0h24v24H0V0z" fill="none"></path>
                          <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"></path>
                        </svg>
                      </label>
                      <div className="settings-appearance-font-control-group" style={{ width: '320px', maxWidth: '320px' }}>
                        <input 
                          id="settings-appearance-message-font-select" 
                          type="text" 
                          value={fontSearchQuery}
                          onChange={(e) => {
                            setFontSearchQuery(e.target.value);
                            setIsFontDropdownOpen(true);
                          }}
                          onFocus={() => setIsFontDropdownOpen(true)}
                          autoComplete="off" 
                          spellCheck="false" 
                          placeholder="Search Google Fonts" 
                          style={{ 
                            fontFamily: settings.fontFamily === 'inherit' ? 'inherit' : settings.fontFamily, 
                            cursor: 'text' 
                          }}
                        />
                        <button 
                          id="settings-appearance-message-font-reset-button" 
                          className="settings-font-reset-button" 
                          type="button" 
                          onClick={handleResetFont}
                          aria-label="Reset to default" 
                          data-tippy-content="Reset to default"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="800px" height="800px" viewBox="0 0 1920 1920" aria-hidden="true">
                            <path d="M960 0v213.333c411.627 0 746.667 334.934 746.667 746.667S1371.627 1706.667 960 1706.667 213.333 1371.733 213.333 960c0-197.013 78.4-382.507 213.334-520.747v254.08H640V106.667H53.333V320h191.04C88.64 494.08 0 720.96 0 960c0 529.28 430.613 960 960 960s960-430.72 960-960S1489.387 0 960 0" fillRule="evenodd"></path>
                          </svg>
                        </button>
                        <AnimatePresence>
                          {isFontDropdownOpen && (
                            <motion.div 
                              id="settings-appearance-message-font-options"
                              initial={{ opacity: 0, y: -10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -10, scale: 0.95 }}
                              transition={{ duration: 0.2, ease: 'easeOut' }}
                            >
                              <motion.div
                                initial="hidden"
                                animate="visible"
                                variants={{
                                  visible: {
                                    transition: {
                                      staggerChildren: 0.015
                                    }
                                  }
                                }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}
                              >
                                {filteredFonts.map((f) => (
                                  <motion.button 
                                    key={f.id}
                                    type="button" 
                                    variants={{
                                      hidden: { opacity: 0, x: -10 },
                                      visible: { opacity: 1, x: 0 }
                                    }}
                                    className={`settings-font-option-item ${settings.fontFamily === f.id ? 'selected' : ''}`} 
                                    onClick={() => handleSelectFont(f)}
                                    style={{ fontFamily: f.id === 'inherit' ? 'inherit' : f.name }}
                                  >
                                    {f.name}
                                  </motion.button>
                                ))}
                                {/* Dynamic option if query doesn't match predefined list */}
                                {fontSearchQuery.trim() && !popularFonts.some(f => f.name.toLowerCase() === fontSearchQuery.toLowerCase()) && (
                                  <motion.button 
                                    type="button" 
                                    variants={{
                                      hidden: { opacity: 0, x: -10 },
                                      visible: { opacity: 1, x: 0 }
                                    }}
                                    className="settings-font-option-item" 
                                    onClick={() => handleSelectFont({ id: fontSearchQuery, name: fontSearchQuery })}
                                    style={{ color: 'var(--accent-color, #ff6060)' }}
                                  >
                                    Use "{fontSearchQuery}" (Google Font)
                                  </motion.button>
                                )}
                              </motion.div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="setting-section">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Font Size</label>
                      <div className="size-slider-row">
                        <input 
                          type="range" 
                          min="12" 
                          max="24" 
                          value={settings.textSize || 15}
                          onChange={(e) => updateSettings({ textSize: parseInt(e.target.value) })}
                          style={{ flex: 1 }}
                        />
                        <span style={{ minWidth: 40, textAlign: 'right', fontWeight: 600, color: '#fff' }}>
                          {settings.textSize || 15}px
                        </span>
                      </div>
                    </div>

                    <div className="setting-section">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Feed Layout Style</label>
                      <div className="theme-selector">
                        <button
                          className={`theme-option ${settings.chatStyle === 'default' ? 'active' : ''}`}
                          onClick={() => updateSettings({ chatStyle: 'default' })}
                          type="button"
                        >
                          Default
                        </button>
                        <button
                          className={`theme-option ${settings.chatStyle === 'compact' ? 'active' : ''}`}
                          onClick={() => updateSettings({ chatStyle: 'compact' })}
                          type="button"
                        >
                          Compact
                        </button>
                        <button
                          className={`theme-option ${settings.chatStyle === 'bubble' ? 'active' : ''}`}
                          onClick={() => updateSettings({ chatStyle: 'bubble' })}
                          type="button"
                        >
                          Bubbles
                        </button>
                      </div>
                    </div>

                    <div className="setting-section">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Dashboard Theme</label>
                      <div className="theme-selector">
                        {themes.map(t => (
                          <button
                            key={t.id}
                            className={`theme-option ${settings.theme === t.id ? 'active' : ''}`}
                            onClick={() => updateSettings({ theme: t.id })}
                            type="button"
                          >
                            {t.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="setting-section">
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Custom Accent Color
                      </label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                        {[
                          { hex: '', name: 'Default' },
                          { hex: '#00ffff', name: 'Cyan' },
                          { hex: '#ff007f', name: 'Pink' },
                          { hex: '#10b981', name: 'Emerald' },
                          { hex: '#f59e0b', name: 'Amber' },
                          { hex: '#a855f7', name: 'Purple' }
                        ].map(color => {
                          const isSelected = (!settings.accentColor && color.hex === '') || settings.accentColor === color.hex;
                          return (
                            <button
                              key={color.name}
                              type="button"
                              onClick={() => updateSettings({ accentColor: color.hex })}
                              title={color.name}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: isSelected ? '2px solid #ffffff' : '2px solid transparent',
                                backgroundColor: color.hex || 'rgba(255,255,255,0.15)',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: isSelected ? '0 0 10px rgba(255,255,255,0.3)' : 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {color.hex === '' && (
                                <span style={{ fontSize: '10px', color: '#fff', fontWeight: 700 }}>✕</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Subtab Panel: Behavior */}
              {appearanceSubtab === 'behavior' && (
                <div className="settings-appearance-subtab-panel active">
                  <div className="settings-section-card">
                    <div className="settings-header-secondary">Profile Pictures & Display Options</div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show Kick Profile Pictures</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={settings.showKickProfilePictures !== false}
                            onChange={(e) => updateSettings({ showKickProfilePictures: e.target.checked })}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show Twitch Profile Pictures</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={settings.showTwitchProfilePictures !== false}
                            onChange={(e) => updateSettings({ showTwitchProfilePictures: e.target.checked })}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show YouTube Profile Pictures</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={settings.showYoutubeProfilePictures !== false}
                            onChange={(e) => updateSettings({ showYoutubeProfilePictures: e.target.checked })}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show Quick Moderation Buttons</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={!!settings.showQuickModActions}
                            onChange={(e) => updateSettings({ showQuickModActions: e.target.checked })}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show Channel Name</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={!!settings.showChannelName}
                            onChange={(e) => updateSettings({ showChannelName: e.target.checked })}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Remove @ Symbol from Usernames</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={!!settings.removeAtSymbol}
                            onChange={(e) => updateSettings({ removeAtSymbol: e.target.checked })}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Alternating Row Backgrounds</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={!!settings.alternatingBackgrounds}
                            onChange={(e) => updateSettings({ alternatingBackgrounds: e.target.checked })}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Randomize YouTube/TikTok Name Colors</span>
                        <label className="switch">
                          <input 
                            type="checkbox" 
                            checked={!!settings.randomNameColors}
                            onChange={(e) => updateSettings({ randomNameColors: e.target.checked })}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>

                      <div className="setting-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Scroll-Lock Release Threshold</label>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-color, #ff6060)' }}>
                            {settings.scrollLockThreshold !== undefined ? settings.scrollLockThreshold : 80}px
                          </span>
                        </div>
                        <div className="size-slider-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="range" 
                            min="40" 
                            max="250" 
                            step="10"
                            value={settings.scrollLockThreshold !== undefined ? settings.scrollLockThreshold : 80}
                            onChange={(e) => updateSettings({ scrollLockThreshold: parseInt(e.target.value) })}
                            style={{ flex: 1 }}
                          />
                        </div>
                        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                          How close to the bottom (in pixels) you must be to lock the scroll. Scrolled up past this threshold will unlock the feed.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab Panel: Emotes */}
              {appearanceSubtab === 'emotes' && (
                <div className="settings-appearance-subtab-panel active">
                  <div className="settings-section-card">
                    <div className="settings-header-secondary">Emote Preferences</div>
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                      Enable animated GIF/WebP emotes from Third-Party integrations.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Enable 7TV Emotes (Kick/Twitch)</span>
                        <label className="switch">
                          <input type="checkbox" defaultChecked />
                          <span className="slider"></span>
                        </label>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Enable BetterTTV Emotes</span>
                        <label className="switch">
                          <input type="checkbox" defaultChecked />
                          <span className="slider"></span>
                        </label>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, color: '#d4d4d4' }}>Enable FrankerFaceZ Emotes</span>
                        <label className="switch">
                          <input type="checkbox" defaultChecked />
                          <span className="slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="settings-section" id="preferences">
              <div className="settings-section-card">
                <div className="settings-header-secondary">Chat Metadata Options</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show Timestamps</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!settings.showTimestamps}
                        onChange={(e) => updateSettings({ showTimestamps: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show Platform Icon Badges</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!settings.showIcons}
                        onChange={(e) => updateSettings({ showIcons: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show Chatter Badges (Mod, Sub, etc)</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!settings.showBadges}
                        onChange={(e) => updateSettings({ showBadges: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#d4d4d4' }}>Show Watch-Time Level Badges</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!settings.showLevelBadges}
                        onChange={(e) => updateSettings({ showLevelBadges: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#d4d4d4' }}>Hide Bot Messages (Nightbot, etc)</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!settings.hideBotMessages}
                        onChange={(e) => updateSettings({ hideBotMessages: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="settings-section-card" style={{ marginTop: '12px' }}>
                <div className="settings-header-secondary">Super Chat & Donations</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="setting-section" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Super Chat Currency</label>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-color, #ff6060)' }}>
                        {settings.superchatCurrency || '₹'}
                      </span>
                    </div>
                    <AnimatedDropdown
                      value={settings.superchatCurrency || '₹'}
                      onChange={(val) => updateSettings({ superchatCurrency: val })}
                      items={[
                        { name: '₹ INR (Indian Rupee)', value: '₹' },
                        { name: '$ USD (US Dollar)', value: '$' },
                        { name: '€ EUR (Euro)', value: '€' },
                        { name: '£ GBP (British Pound)', value: '£' },
                        { name: 'C$ CAD (Canadian Dollar)', value: 'C$' },
                        { name: 'A$ AUD (Australian Dollar)', value: 'A$' },
                        { name: '¥ JPY (Japanese Yen)', value: '¥' },
                        { name: 'R$ BRL (Brazilian Real)', value: 'R$' },
                        { name: '₱ PHP (Philippine Peso)', value: '₱' },
                        { name: '₩ KRW (Korean Won)', value: '₩' },
                        { name: 'S$ SGD (Singapore Dollar)', value: 'S$' },
                        { name: 'NZ$ NZD (New Zealand Dollar)', value: 'NZ$' }
                      ]}
                      text="Select Currency"
                      className="settings-voice-dropdown"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-section-card" style={{ marginTop: '12px' }}>
                <div className="settings-header-secondary">Text-to-Speech (TTS)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#d4d4d4' }}>Enable TTS for Messages (Auto-Read)</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!settings.enableTts}
                        onChange={(e) => updateSettings({ enableTts: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#d4d4d4' }}>Enable Superchat TTS (Auto-Read)</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!settings.enableSuperchatTts}
                        onChange={(e) => updateSettings({ enableSuperchatTts: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 14, color: '#d4d4d4' }}>Ignore Bot Messages (TTS)</span>
                      <span style={{ fontSize: 11, color: '#71717a' }}>Skip reading Nightbot, StreamElements, BotRix, etc.</span>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={settings.ttsIgnoreBots !== false}
                        onChange={(e) => updateSettings({ ttsIgnoreBots: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="setting-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>TTS Volume</label>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-color, #ff6060)' }}>
                        {settings.ttsVolume !== undefined ? settings.ttsVolume : 50}%
                      </span>
                    </div>
                    <div className="size-slider-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={settings.ttsVolume !== undefined ? settings.ttsVolume : 50}
                        onChange={(e) => updateSettings({ ttsVolume: parseInt(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  <div className="setting-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>TTS Speech Speed (Rate)</label>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-color, #ff6060)' }}>
                        {settings.ttsSpeed !== undefined ? settings.ttsSpeed : 1.0}x
                      </span>
                    </div>
                    <div className="size-slider-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2.0" 
                        step="0.1"
                        value={settings.ttsSpeed !== undefined ? settings.ttsSpeed : 1.0}
                        onChange={(e) => updateSettings({ ttsSpeed: parseFloat(e.target.value) })}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>

                  <div className="setting-section" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>TTS Voice</label>
                    <AnimatedDropdown
                      value={settings.ttsVoiceName || ''}
                      onChange={(val) => updateSettings({ ttsVoiceName: val })}
                      items={[
                        { name: 'Default Browser Voice', value: '' },
                        ...(voices || []).map(voice => {
                          if (!voice) return { name: 'Voice', value: '' };
                          const vLang = voice.lang || '';
                          const vName = voice.name || 'Voice';
                          const isIndian = vLang.toLowerCase().includes('in') || 
                                           vName.toLowerCase().includes('india') || 
                                           vName.toLowerCase().includes('hindi');
                          return {
                            name: `${vName} (${vLang})${isIndian ? ' 🇮🇳 (Hinglish/India)' : ''}`,
                            value: vName
                          };
                        })
                      ]}
                      text="Select Voice"
                      className="settings-voice-dropdown"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-section-card" style={{ marginTop: '12px' }}>
                <div className="settings-header-secondary">Audio Notifications</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, color: '#d4d4d4' }}>Play Sound on Chat Mentions</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={!!settings.enableMentionSound}
                        onChange={(e) => updateSettings({ enableMentionSound: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div className="setting-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Mention Sound Volume</label>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-color, #ff6060)' }}>
                        {settings.mentionSoundVolume !== undefined ? settings.mentionSoundVolume : 50}%
                      </span>
                    </div>
                    <div className="size-slider-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={settings.mentionSoundVolume !== undefined ? settings.mentionSoundVolume : 50}
                        onChange={(e) => updateSettings({ mentionSoundVolume: parseInt(e.target.value) })}
                        style={{ flex: 1 }}
                        disabled={!settings.enableMentionSound}
                      />
                    </div>
                  </div>

                  <div className="setting-section" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Mention Sound Style</label>
                    <AnimatedDropdown
                      value={settings.mentionSoundType || 'bell'}
                      onChange={(val) => updateSettings({ mentionSoundType: val })}
                      items={[
                        { name: 'Double Chime (Bell)', value: 'bell' },
                        { name: '8-Bit Coin (Retro)', value: 'retro' },
                        { name: 'Bubble Pop (Satisfying)', value: 'bubble' },
                        { name: 'High-Tech Blip (Digital)', value: 'digital' }
                      ]}
                      disabled={!settings.enableMentionSound}
                      className="settings-mentionsound-dropdown"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MODERATION */}
          {activeTab === 'moderation' && (
            <div className="settings-section" id="moderation">
              <div className="settings-section-card">
                <div className="settings-header-secondary">Moderated Phrases (Blocklist)</div>
                <form className="blocklist-input-row" onSubmit={handleAddBlocklistWord} style={{ display: 'flex', gap: 6 }}>
                  <input 
                    type="text" 
                    placeholder="Enter banned phrase..." 
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="add-channel-btn" style={{ minWidth: '40px', padding: 0 }}>
                    <Plus size={16} />
                  </button>
                </form>
                
                <div className="blocklist-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {(settings.blocklist || []).map(word => (
                    <span key={word} className="blocklist-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: 13 }}>
                      {word}
                      <button onClick={() => handleRemoveBlocklistWord(word)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {(!settings.blocklist || settings.blocklist.length === 0) && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Blocklist is empty. Add phrases above to censor them.
                    </span>
                  )}
                </div>
              </div>

              <div className="settings-section-card">
                <div className="settings-header-secondary">Blocked Chatters (Hide Messages)</div>
                <div className="blocklist-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {blockedUsers && Array.from(blockedUsers).map(username => (
                    <span key={username} className="blocklist-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: 13 }}>
                      {username}
                      <button onClick={() => onUnblockUser(username)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {(!blockedUsers || blockedUsers.size === 0) && (
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      No chatters blocked.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CHANNELS */}
          {activeTab === 'channels' && (
            <div className="settings-section" id="channels">
              <div className="settings-section-card">
                <div className="settings-header-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <TelevisionIcon size={16} style={{ color: 'var(--accent-color, #ff6060)' }} /> Connect Stream Channels
                </div>
                
                {/* Add Channel Form */}
                <form className="add-channel-form" onSubmit={handleChannelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px', display: 'block' }}>
                      Select Platform
                    </span>
                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                      {[
                        { id: 'twitch', name: 'Twitch', color: '#9146FF', activeBg: 'rgba(145, 70, 255, 0.15)' },
                        { id: 'youtube', name: 'YouTube', color: '#FF0000', activeBg: 'rgba(255, 0, 0, 0.12)' },
                        { id: 'kick', name: 'Kick', color: '#53fc18', activeBg: 'rgba(83, 252, 24, 0.12)' }
                      ].map(plat => {
                        const isSelected = platform === plat.id;
                        return (
                          <button
                            key={plat.id}
                            type="button"
                            onClick={() => setPlatform(plat.id)}
                            className={`platform-selector-btn ${isSelected ? 'platform-btn-active' : ''}`}
                            style={{
                              flex: 1,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '12px 8px',
                              borderRadius: '12px',
                              border: isSelected ? `2px solid ${plat.color}` : '1px solid rgba(255, 255, 255, 0.05)',
                              background: isSelected ? plat.activeBg : 'rgba(255, 255, 255, 0.01)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              gap: '6px',
                              color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)'
                            }}
                          >
                            <PlatformLogo platform={plat.id} size={20} />
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>{plat.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Channel Username / Handle
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder={`Enter ${platform} handle (e.g. xqc)...`} 
                        value={channelName}
                        onChange={(e) => setChannelName(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button type="submit" className="add-channel-btn" disabled={isValidating} style={{ width: '140px', flexShrink: 0 }}>
                        {isValidating ? (
                          <><Loader2 size={15} className="spin-icon" style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline-block' }} /> Validating...</>
                        ) : (
                          <><Plus size={15} style={{ marginRight: 4, verticalAlign: 'middle', display: 'inline-block' }} /> Connect</>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Connected Channels Header */}
                {activeChannels.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: 16, marginBottom: 8 }}>
                    Connected Channels ({activeChannels.length})
                  </div>
                )}

                {/* Channels List */}
                <div className="channel-list" style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {activeChannels.map(ch => {
                    const cleanName = ch.name.toLowerCase().replace(/^@+/, '').trim();
                    const rawClean = ch.name.toLowerCase().replace('@', '').trim();
                    const atClean = `@${rawClean}`;
                    const channelSpecificStatus = platformStatuses?.[cleanName] || 
                                                 platformStatuses?.[rawClean] || 
                                                 platformStatuses?.[atClean] || 
                                                 platformStatuses?.[ch.name] || 
                                                 platformStatuses?.[ch.name.toLowerCase()];
                    const status = !ch.enabled
                      ? 'disconnected'
                      : (channelSpecificStatus || (platformStatuses?.[ch.platform] === 'connected' ? 'connected' : 'connecting'));
                    const statusColor = status === 'connected' ? '#10b981' : status === 'connecting' ? '#38bdf8' : status === 'offline' ? '#f59e0b' : '#71717a';

                    return (
                      <div key={ch.id} className="channel-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', marginBottom: 8 }}>
                        <div className="channel-info" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <PlatformLogo platform={ch.platform} isShorts={ch.platform === 'youtube' && (youtubeShortsChannels.has(cleanName) || youtubeShortsChannels.has(rawClean) || youtubeShortsChannels.has(ch.name))} size={18} />
                          <div>
                            <div className="channel-name" style={{ fontWeight: 600, fontSize: 14, color: '#ffffff' }}>{ch.name}</div>
                            <div className="channel-platform" style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <span style={{ textTransform: 'capitalize' }}>{ch.platform}</span>
                              <span>•</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                                <span style={{
                                  width: '5px',
                                  height: '5px',
                                  borderRadius: '50%',
                                  backgroundColor: statusColor,
                                  boxShadow: `0 0 6px ${statusColor}`,
                                  display: 'inline-block',
                                  marginRight: '5px'
                                }} />
                                <span style={{ color: statusColor, fontWeight: 600 }}>{status}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="channel-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <label className="switch">
                            <input 
                              type="checkbox" 
                              checked={ch.enabled} 
                              onChange={() => toggleChannel(ch.id)}
                            />
                            <span className="slider"></span>
                          </label>
                          
                          <button className="delete-btn" onClick={() => removeChannel(ch.id)} style={{ padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {activeChannels.length === 0 && (
                    <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      No channels connected yet. Select a platform and enter your handle above to begin.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CONNECTIONS */}
          {activeTab === 'connections' && (
            <div className="settings-section" id="connections">
              <div className="settings-section-card">
                <div className="settings-header-secondary">Integrations & Accounts</div>
                <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  Link your streamer accounts directly to authenticate, fetch moderators, write messages to chat, and synchronize overlay themes.
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(145, 70, 255, 0.1)', border: '1px solid rgba(145, 70, 255, 0.2)', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PlatformLogo platform="twitch" size={18} />
                      <span style={{ fontWeight: 600 }}>Twitch Account</span>
                    </div>
                    <button className="add-channel-btn" style={{ minWidth: '7em', padding: '4px 10px', fontSize: 12.5 }} type="button">Connect</button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: 'rgba(83, 252, 24, 0.06)', border: '1px solid rgba(83, 252, 24, 0.18)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PlatformLogo platform="kick" size={18} />
                        <span style={{ fontWeight: 600 }}>Kick Account</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {(typeof window !== 'undefined' && localStorage.getItem('prochat_kick_auth_token')) && (
                          <button
                            className="add-channel-btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: 12.5,
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}
                            onClick={async () => {
                              if (confirm(`Disconnect Kick account @${localStorage.getItem('prochat_kick_username') || 'Kick User'}?`)) {
                                try {
                                  const { asSupabase } = await import('@/lib/supabase');
                                  const { data: { session } } = await asSupabase.auth.getSession();
                                  const uId = session?.user?.id;
                                  const uEmail = session?.user?.email;

                                  if (uId || uEmail) {
                                    const conds = [];
                                    if (uId) conds.push(`id.eq.${uId}`);
                                    if (uEmail) conds.push(`email.eq.${uEmail}`);
                                    await asSupabase.from('Kick').update({
                                      is_connected: false,
                                      updated_at: new Date().toISOString()
                                    }).or(conds.join(','));
                                  }
                                } catch (e) {}

                                localStorage.setItem('prochat_kick_disconnected', 'true');
                                localStorage.removeItem('prochat_kick_auth_token');
                                localStorage.removeItem('prochat_kick_username');
                                document.cookie = 'prochat_kick_auth_token=; path=/; max-age=0';
                                document.cookie = 'prochat_kick_username=; path=/; max-age=0';

                                try {
                                  const channels = JSON.parse(localStorage.getItem('prochat_channels') || '[]');
                                  const updatedChannels = channels.filter(ch => ch.platform !== 'kick');
                                  localStorage.setItem('prochat_channels', JSON.stringify(updatedChannels));
                                } catch (e) {}

                                window.location.reload();
                              }
                            }}
                            type="button"
                          >
                            Disconnect
                          </button>
                        )}
                        <button 
                          className="add-channel-btn" 
                          style={{
                            minWidth: '7em',
                            padding: '4px 10px',
                            fontSize: 12.5,
                            background: (typeof window !== 'undefined' && localStorage.getItem('prochat_kick_auth_token')) ? 'rgba(16, 185, 129, 0.15)' : undefined,
                            color: (typeof window !== 'undefined' && localStorage.getItem('prochat_kick_auth_token')) ? '#10b981' : undefined,
                            border: (typeof window !== 'undefined' && localStorage.getItem('prochat_kick_auth_token')) ? '1px solid rgba(16, 185, 129, 0.3)' : undefined
                          }} 
                          onClick={async () => {
                            try {
                              localStorage.removeItem('prochat_kick_disconnected');
                              let userId = user?.id || '';
                              let email = currentUserEmail || '';

                              if (!userId) {
                                try {
                                  const { asSupabase } = await import('@/lib/supabase');
                                  const { data: { session } } = await asSupabase.auth.getSession();
                                  if (session?.user?.id) {
                                    userId = session.user.id;
                                    email = email || session.user.email || '';
                                  }
                                } catch (e) {}
                              }
                              const getRandomBytes = (len) => {
                                const arr = new Uint8Array(len);
                                window.crypto.getRandomValues(arr);
                                return arr;
                              };
                              const base64Url = (buf) => {
                                return btoa(String.fromCharCode(...new Uint8Array(buf)))
                                  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
                              };

                              const verifierBytes = getRandomBytes(32);
                              const codeVerifier = base64Url(verifierBytes);
                              const encoder = new TextEncoder();
                              const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(codeVerifier));
                              const codeChallenge = base64Url(hashBuffer);

                              const rawState = Array.from(getRandomBytes(16)).map(b => b.toString(16).padStart(2, '0')).join('');
                              const stateObj = { s: rawState, v: codeVerifier, u: userId, e: email };
                              const state = btoa(encodeURIComponent(JSON.stringify(stateObj)))
                                .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

                              document.cookie = `kick_oauth_state=${state}; path=/; max-age=600; Secure; SameSite=Lax`;
                              document.cookie = `kick_code_verifier=${codeVerifier}; path=/; max-age=600; Secure; SameSite=Lax`;
                              if (userId) document.cookie = `kick_oauth_user_id=${userId}; path=/; max-age=600; Secure; SameSite=Lax`;
                              if (email) document.cookie = `kick_oauth_user_email=${email}; path=/; max-age=600; Secure; SameSite=Lax`;

                              try {
                                localStorage.setItem('kick_code_verifier', codeVerifier);
                                localStorage.setItem('kick_oauth_state', state);
                                if (userId) localStorage.setItem('kick_oauth_user_id', userId);
                                if (email) localStorage.setItem('kick_oauth_user_email', email);
                              } catch (e) {}

                              const canonicalOrigin = window.location.origin.replace(/\/$/, '');
                              const redirectUri = `${canonicalOrigin}/api/kick/callback`;
                              const clientId = '01KZGGD32S5919AGF28KSKKT1J';
                              const scope = 'user:read chat:write events:subscribe moderation:ban moderation:chat_message:manage channel:read channel:write';

                              const directAuthUrl = `https://id.kick.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

                              window.location.href = directAuthUrl;
                            } catch (err) {
                              const authParams = new URLSearchParams();
                              if (user?.id) authParams.append('user_id', user.id);
                              if (currentUserEmail) authParams.append('email', currentUserEmail);
                              window.location.href = `/api/kick/auth${authParams.toString() ? `?${authParams.toString()}` : ''}`;
                            }
                          }} 
                          type="button"
                        >
                          {(typeof window !== 'undefined' && localStorage.getItem('prochat_kick_auth_token')) ? '✓ Re-Pair Kick' : 'Connect via Kick OAuth'}
                        </button>
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                      {(typeof window !== 'undefined' && localStorage.getItem('prochat_kick_username'))
                        ? `Connected to Kick account @${localStorage.getItem('prochat_kick_username')}. Click button to disconnect or re-pair.`
                        : 'Connect via official 1-Click Kick OAuth to grant chat & moderation permissions directly.'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', background: 'rgba(230, 0, 0, 0.06)', border: '1px solid rgba(230, 0, 0, 0.18)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <PlatformLogo platform="youtube" size={18} />
                        <span style={{ fontWeight: 600 }}>YouTube Account</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button 
                          className="add-channel-btn" 
                          style={{
                            minWidth: '7em',
                            padding: '4px 10px',
                            fontSize: 12.5,
                            background: (youtubeConnected || settings?.youtubeConnected) ? 'rgba(16, 185, 129, 0.15)' : undefined,
                            color: (youtubeConnected || settings?.youtubeConnected) ? '#10b981' : undefined,
                            border: (youtubeConnected || settings?.youtubeConnected) ? '1px solid rgba(16, 185, 129, 0.3)' : undefined
                          }} 
                          onClick={() => {
                            if (youtubeConnected || settings?.youtubeConnected) {
                              alert("You have already connected YouTube. You can re-pair anytime.");
                            }
                            window.location.href = '/connect-youtube';
                          }} 
                          type="button"
                        >
                          {(youtubeConnected || settings?.youtubeConnected) ? '✓ Connected' : 'Connect via Companion App'}
                        </button>
                      </div>
                    </div>

                    {linkedChannel && (linkedChannel.channel_name || linkedChannel.custom_handle) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)', background: '#18181b', flexShrink: 0 }}>
                          {linkedChannel.avatar_url ? (
                            <img src={linkedChannel.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 11, color: '#fff' }}>
                              {(linkedChannel.channel_name || 'Y').charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: '#e4e4e7', lineHeight: 1.4 }}>
                          📌 Network Linked Channel: <a href={linkedChannel.channel_id ? `https://www.youtube.com/channel/${linkedChannel.channel_id}` : `https://www.youtube.com/${linkedChannel.custom_handle || ''}`} target="_blank" rel="noreferrer" style={{ color: '#ffffff', fontWeight: 700, textDecoration: 'underline' }}>{linkedChannel.channel_name || linkedChannel.custom_handle}</a>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: OVERLAY */}
          {activeTab === 'overlay' && (
            <div className="settings-section" id="overlay">
              {/* Highlight Overlay Card */}
              <div className="settings-section-card" style={{ border: '1px solid rgba(56, 189, 248, 0.3)', background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.06), rgba(9, 10, 15, 0.6))' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div className="settings-header-secondary" style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Tv size={16} />
                    <span>Live Stream Chat Highlight Overlay (OBS)</span>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>FEATURED</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Click any chat or Super Chat in the dashboard (or press <kbd style={{ background: '#27272a', padding: '1px 5px', borderRadius: '3px', color: '#fff' }}>ESC</kbd> to hide) to instantly feature it on stream with slide-in animations, chatter badges, and golden ribbon tiers.
                  </span>
                  <div className="obs-url-box" style={{ background: '#090a0f', padding: '10px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.2)', fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all', color: '#bae6fd' }}>
                    {getHighlightOverlayUrl()}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="add-channel-btn" 
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0', background: '#0284c7' }}
                      onClick={handleCopyHighlightUrl}
                      type="button"
                    >
                      {highlightCopied ? <Check size={16} /> : <Copy size={16} />}
                      {highlightCopied ? 'Copied Highlight URL!' : 'Copy Highlight Overlay URL'}
                    </button>
                    <button 
                      type="button"
                      onClick={handleTestHighlight}
                      style={{
                        padding: '0 16px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Send a sample highlight to test your OBS overlay"
                    >
                      <span>🚀 Test Highlight</span>
                    </button>
                  </div>

                  {/* Highlight Overlay Customization Settings */}
                  <div style={{ marginTop: '8px', borderTop: '1px solid rgba(56, 189, 248, 0.15)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Highlight Overlay Display & Styling
                    </div>

                    {/* Social Media / Platform Logo Toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Show Social Media / Platform Logo</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Display platform logo (YouTube, Kick, Twitch) next to the chatter name</div>
                      </div>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={!!settings.highlightShowPlatformLogo}
                          onChange={(e) => updateSettings({ highlightShowPlatformLogo: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>

                    {/* Show Only First Name Toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Show Only First Name</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Trim chatter usernames with multiple words to only their first name</div>
                      </div>
                      <label className="switch">
                        <input 
                          type="checkbox" 
                          checked={!!settings.highlightFirstNameOnly}
                          onChange={(e) => updateSettings({ highlightFirstNameOnly: e.target.checked })}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>

                    {/* Color Controls Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {/* Author Tag Background */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#d4d4d4' }}>Author Tag Background</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input 
                            type="color" 
                            value={settings.highlightAuthorBgColor || '#ffa500'}
                            onChange={(e) => updateSettings({ highlightAuthorBgColor: e.target.value })}
                            style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                          />
                          <input 
                            type="text" 
                            value={settings.highlightAuthorBgColor || '#ffa500'}
                            onChange={(e) => updateSettings({ highlightAuthorBgColor: e.target.value })}
                            placeholder="#ffa500"
                            style={{ flex: 1, padding: '6px 8px', background: '#090a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                          />
                        </div>
                      </div>

                      {/* Author Tag Text Color */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#d4d4d4' }}>Author Tag Text Color</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input 
                            type="color" 
                            value={settings.highlightAuthorTextColor || '#222222'}
                            onChange={(e) => updateSettings({ highlightAuthorTextColor: e.target.value })}
                            style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                          />
                          <input 
                            type="text" 
                            value={settings.highlightAuthorTextColor || '#222222'}
                            onChange={(e) => updateSettings({ highlightAuthorTextColor: e.target.value })}
                            placeholder="#222222"
                            style={{ flex: 1, padding: '6px 8px', background: '#090a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                          />
                        </div>
                      </div>

                      {/* Chat Message Box Background */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#d4d4d4' }}>Message Box Background</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input 
                            type="color" 
                            value={settings.highlightCommentBgColor || '#222222'}
                            onChange={(e) => updateSettings({ highlightCommentBgColor: e.target.value })}
                            style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                          />
                          <input 
                            type="text" 
                            value={settings.highlightCommentBgColor || '#222222'}
                            onChange={(e) => updateSettings({ highlightCommentBgColor: e.target.value })}
                            placeholder="#222222"
                            style={{ flex: 1, padding: '6px 8px', background: '#090a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                          />
                        </div>
                      </div>

                      {/* Chat Message Box Text Color */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#d4d4d4' }}>Message Box Text Color</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input 
                            type="color" 
                            value={settings.highlightCommentTextColor || '#ffffff'}
                            onChange={(e) => updateSettings({ highlightCommentTextColor: e.target.value })}
                            style={{ width: '32px', height: '32px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                          />
                          <input 
                            type="text" 
                            value={settings.highlightCommentTextColor || '#ffffff'}
                            onChange={(e) => updateSettings({ highlightCommentTextColor: e.target.value })}
                            placeholder="#ffffff"
                            style={{ flex: 1, padding: '6px 8px', background: '#090a0f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Standard Rolling Chat Overlay Card */}
              <div className="settings-section-card" style={{ marginTop: '12px' }}>
                <div className="settings-header-secondary">Standard Rolling Chat Overlay URL</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    Copy this link to display continuous live chat feed inside OBS Studio.
                  </span>
                  <div className="obs-url-box" style={{ background: '#090a0f', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)', fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}>
                    {getOverlayUrl()}
                  </div>
                  <button 
                    className="add-channel-btn" 
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 0' }}
                    onClick={handleCopyUrl}
                    type="button"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied to Clipboard!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              <div className="settings-section-card" style={{ marginTop: '12px' }}>
                <div className="settings-header-secondary">Overlay Message Customization</div>
                
                <div className="setting-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Message Fade Duration</label>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-color, #ff6060)' }}>
                      {settings.overlayFadeTime === 0 ? 'Never Fade' : `${settings.overlayFadeTime} seconds`}
                    </span>
                  </div>
                  <div className="size-slider-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="range" 
                      min="0" 
                      max="60" 
                      step="1"
                      value={settings.overlayFadeTime !== undefined ? settings.overlayFadeTime : 10}
                      onChange={(e) => updateSettings({ overlayFadeTime: parseInt(e.target.value) })}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: '-4px', display: 'block' }}>
                    Adjust how many seconds messages stay visible on screen before fading out. Set to 0 to keep messages visible indefinitely.
                  </span>
                </div>

                <div className="setting-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Enable High-Contrast Text Outline</span>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={settings.overlayTextOutline !== undefined ? settings.overlayTextOutline : true}
                        onChange={(e) => updateSettings({ overlayTextOutline: e.target.checked })}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Text Shadow Intensity</label>
                    <AnimatedDropdown
                      value={settings.overlayTextShadow || 'medium'}
                      onChange={(val) => updateSettings({ overlayTextShadow: val })}
                      items={[
                        { name: 'None', value: 'none' },
                        { name: 'Subtle', value: 'subtle' },
                        { name: 'Medium', value: 'medium' },
                        { name: 'Heavy', value: 'heavy' }
                      ]}
                      className="settings-textshadow-dropdown"
                    />
                  </div>
                </div>

                <div className="setting-section" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#d4d4d4' }}>Custom CSS</label>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Apply custom styles to the overlay. e.g. <code>.msg-username &#123; font-weight: 900; &#125;</code>
                  </span>
                  <textarea
                    style={{
                      width: '100%',
                      height: '80px',
                      background: '#090a0f',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontFamily: 'monospace',
                      fontSize: '11.5px',
                      padding: '8px',
                      resize: 'vertical',
                      outline: 'none'
                    }}
                    value={settings.overlayCustomCss || ''}
                    onChange={(e) => updateSettings({ overlayCustomCss: e.target.value })}
                    placeholder="/* Custom styles for your OBS overlay */&#10;.chat-message-row {&#10;  background: rgba(0,0,0,0.15) !important;&#10;}"
                    spellCheck="false"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: PREMIUM */}
          {activeTab === 'premium' && (
            <div className="settings-section" id="premium">
              <div className="settings-section-card" style={{ background: 'linear-gradient(135deg, rgba(255, 96, 96, 0.15) 0%, rgba(181, 28, 28, 0.1) 100%)', borderColor: 'rgba(255, 96, 96, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff6060', fontSize: '1.25em', fontWeight: 800 }}>
                  <Gem size={20} /> ProChat Premium
                </div>
                <div style={{ fontSize: 13.5, color: '#d4d4d4', lineHeight: 1.5, marginTop: 4 }}>
                  Unlock custom overlays, dedicated chat connections, advanced visual themes, and premium analytics logs to supercharge your stream setup.
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <span style={{ color: '#ff6060' }}>✦</span> Customized overlay layouts & badges
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <span style={{ color: '#ff6060' }}>✦</span> Advanced analytics and chatter metrics
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <span style={{ color: '#ff6060' }}>✦</span> Real-time AI chat translation & insights
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                    <span style={{ color: '#ff6060' }}>✦</span> Unlimited connected accounts & channels
                  </div>
                </div>

                <button 
                  className="add-channel-btn" 
                  style={{ width: '100%', padding: '10px 0', marginTop: 14, background: '#b51c1c', border: '1px solid rgba(255,255,255,0.1)' }}
                  type="button"
                >
                  Upgrade Now (Free Trial)
                </button>
              </div>
            </div>
          )}

          {/* TAB 8: ACCOUNT */}
          {activeTab === 'account' && (
            <div className="settings-section" id="account">
              <div className="settings-section-card">
                <div className="settings-header-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={16} /> User Account Profile
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#b51c1c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
                    S
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15.5 }}>Streamer_User</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>user@prochat.gg</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 10, marginTop: 5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Subscription:</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-color, #ff6060)' }}>Basic (Free)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Joined Date:</span>
                    <span>June 2026</span>
                  </div>
                </div>

                <button className="add-channel-btn" style={{ width: '100%', marginTop: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }} type="button">
                  Sign Out
                </button>
              </div>
            </div>
          )}

        </div>

        {/* 16-Digit Pairing Code & Desktop Companion Modal */}
        <PairingCodeModal 
          isOpen={isPairingModalOpen} 
          onClose={() => setIsPairingModalOpen(false)} 
          userEmail={currentUserEmail} 
          onConnected={() => setYoutubeConnected(true)} 
        />
      </div>
    </div>
  );
}

